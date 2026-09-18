type Scope = "member" | "room"

/**
 * Resolves grants to their current subjects, limited to one member or one room
 * from the start so the database never gathers everyone's permissions.
 * The query binds the scope's id first; `chat_scope` holds it for later clauses.
 */
function chatPermissions(scope: Scope) {
  const id = "(SELECT id FROM chat_scope)"
  const subject = (column: string) =>
    scope === "member"
      ? `${column}=${id}`
      : `${column}=(SELECT year FROM chat_rooms WHERE id=${id})`
  return `WITH chat_scope(id) AS (SELECT ?), chat_subjects AS (
 SELECT ym.year,ym.member_id,j.key AS target_type,j.value AS target_id
 FROM year_memberships ym JOIN app_users u ON u.id=ym.member_id
 JOIN json_each(json_object('member',ym.member_id,'year',CAST(ym.year AS TEXT),'access_level',u.access_level)) j
 WHERE ym.status='active' AND ${subject(scope === "member" ? "ym.member_id" : "ym.year")}
 UNION ALL
 SELECT r.year,mr.member_id,'role',r.id FROM member_year_roles mr JOIN year_roles r ON r.id=mr.role_id
 WHERE ${subject(scope === "member" ? "mr.member_id" : "r.year")}
 UNION ALL
 SELECT r.year,mr.member_id,'permission',p.permission FROM member_year_roles mr
 JOIN year_roles r ON r.id=mr.role_id JOIN year_role_permissions p ON p.role_id=r.id
 WHERE ${subject(scope === "member" ? "mr.member_id" : "r.year")}
 UNION ALL
 SELECT a.year,sa.member_id,'activity',a.id FROM activities a
 JOIN shift_slots s ON s.activity_id=a.id AND s.deleted=0
 JOIN shift_assignments sa ON sa.slot_id=s.id AND sa.status='active'
 WHERE ${subject(scope === "member" ? "sa.member_id" : "a.year")}
 UNION ALL
 SELECT a.year,ym.member_id,'responsible',a.id FROM activities a
 JOIN activity_responsibles ar ON ar.activity_id=a.id
 JOIN year_memberships ym ON ym.year=a.year AND ym.status='active'
 WHERE ${subject(scope === "member" ? "ym.member_id" : "a.year")}
 AND ((ar.target_type='member' AND ar.target_id=ym.member_id)
 OR (ar.target_type='role' AND EXISTS(SELECT 1 FROM member_year_roles mr WHERE mr.member_id=ym.member_id AND mr.role_id=ar.target_id)))
), chat_permissions AS (
 SELECT t.room_id,s.member_id,MAX(t.can_read OR t.can_post OR t.can_manage) AS can_read,
 CASE WHEN link.activity_id IS NULL OR a.active=1 THEN MAX(t.can_post OR t.can_manage) ELSE 0 END AS can_post,
 MAX(t.can_manage) AS can_manage
 FROM chat_room_targets t JOIN chat_rooms r ON r.id=t.room_id
 JOIN chat_subjects s ON s.year=r.year AND s.target_type=t.target_type AND s.target_id=t.target_id
 JOIN year_memberships ym ON ym.year=r.year AND ym.member_id=s.member_id AND ym.status='active'
 LEFT JOIN activity_chat_rooms link ON link.room_id=r.id
 LEFT JOIN activities a ON a.id=link.activity_id
 WHERE ${scope === "room" ? `t.room_id=${id} AND ` : ""}NOT EXISTS(SELECT 1 FROM chat_room_exits x WHERE x.room_id=r.id AND x.member_id=s.member_id)
 GROUP BY t.room_id,s.member_id HAVING MAX(t.can_read OR t.can_post OR t.can_manage)=1
)`
}

/** One member's permissions in every room; binds the member's id first. */
export const memberPermissions = chatPermissions("member")
/** Every member's permissions in one room; binds the room's id first. */
export const roomPermissions = chatPermissions("room")

/** A device to notify, with the member it belongs to. */
export type RoomDevice = {
  memberId: string
  id: string
  endpoint: string
  expirationTime: number | null
  p256dh: string
  auth: string
}

/**
 * Who a new message reaches, in one permission pass. Live delivery and push
 * notifications share it, so sending resolves the room's members once.
 */
export async function roomAudience(env: CloudflareBindings, roomId: string) {
  const result = await env.shift_app
    .prepare(`${roomPermissions}
    SELECT e.member_id AS memberId,COALESCE(p.muted,0) AS muted,
    device.id,device.endpoint,device.expiration_time AS expirationTime,device.p256dh,device.auth
    FROM chat_permissions e
    LEFT JOIN chat_room_preferences p ON p.room_id=e.room_id AND p.member_id=e.member_id
    LEFT JOIN notification_devices device ON device.member_id=e.member_id
     AND device.enabled=1 AND device.endpoint IS NOT NULL
     AND device.p256dh IS NOT NULL AND device.auth IS NOT NULL`)
    .bind(roomId)
    .all<{
      memberId: string
      muted: number
      id: string | null
      endpoint: string | null
      expirationTime: number | null
      p256dh: string | null
      auth: string | null
    }>()
  const members = [...new Set(result.results.map((row) => row.memberId))]
  const devices = result.results.flatMap((row) =>
    row.muted === 0 && row.id && row.endpoint && row.p256dh && row.auth
      ? [
          {
            memberId: row.memberId,
            id: row.id,
            endpoint: row.endpoint,
            expirationTime: row.expirationTime,
            p256dh: row.p256dh,
            auth: row.auth,
          } satisfies RoomDevice,
        ]
      : []
  )
  return { members, devices }
}

export async function roomRecipients(env: CloudflareBindings, roomId: string) {
  const result = await env.shift_app
    .prepare(`${roomPermissions}
    SELECT u.id,u.display_name AS displayName,e.can_manage AS canManage,identity.image,
    COALESCE(p.muted,0) AS muted FROM chat_permissions e
    JOIN app_users u ON u.id=e.member_id LEFT JOIN user identity ON identity.id=u.user_id
    LEFT JOIN chat_room_preferences p ON p.room_id=e.room_id AND p.member_id=e.member_id
    ORDER BY u.student_id`)
    .bind(roomId)
    .all<{
      id: string
      displayName: string
      canManage: number
      image: string | null
      muted: number
    }>()
  return result.results
}
