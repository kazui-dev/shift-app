// The database stores grants; the server resolves their current subjects.
export const chatPermissions = `WITH chat_subjects AS (
 SELECT ym.year,ym.member_id,'member' AS target_type,ym.member_id AS target_id
 FROM year_memberships ym WHERE ym.status='active'
 UNION ALL
 SELECT ym.year,ym.member_id,'year',CAST(ym.year AS TEXT)
 FROM year_memberships ym WHERE ym.status='active'
 UNION ALL
 SELECT ym.year,ym.member_id,'access_level',u.access_level
 FROM year_memberships ym JOIN app_users u ON u.id=ym.member_id WHERE ym.status='active'
 UNION ALL
 SELECT r.year,mr.member_id,'role',r.id FROM member_year_roles mr JOIN year_roles r ON r.id=mr.role_id
 UNION ALL
 SELECT r.year,mr.member_id,'permission',p.permission FROM member_year_roles mr
 JOIN year_roles r ON r.id=mr.role_id JOIN year_role_permissions p ON p.role_id=r.id
 UNION ALL
 SELECT a.year,sa.member_id,'activity',a.id FROM activities a
 JOIN shift_slots s ON s.activity_id=a.id AND s.deleted=0
 JOIN shift_assignments sa ON sa.slot_id=s.id AND sa.status='active'
 UNION ALL
 SELECT a.year,ym.member_id,'responsible',a.id FROM activities a
 JOIN activity_responsibles ar ON ar.activity_id=a.id
 JOIN year_memberships ym ON ym.year=a.year AND ym.status='active'
 WHERE (ar.target_type='member' AND ar.target_id=ym.member_id)
 OR (ar.target_type='role' AND EXISTS(SELECT 1 FROM member_year_roles mr WHERE mr.member_id=ym.member_id AND mr.role_id=ar.target_id))
), chat_permissions AS (
 SELECT t.room_id,s.member_id,MAX(t.can_read OR t.can_post OR t.can_manage) AS can_read,
 CASE WHEN link.activity_id IS NULL OR a.active=1 THEN MAX(t.can_post OR t.can_manage) ELSE 0 END AS can_post,
 MAX(t.can_manage) AS can_manage
 FROM chat_room_targets t JOIN chat_rooms r ON r.id=t.room_id
 JOIN chat_subjects s ON s.year=r.year AND s.target_type=t.target_type AND s.target_id=t.target_id
 JOIN year_memberships ym ON ym.year=r.year AND ym.member_id=s.member_id AND ym.status='active'
 LEFT JOIN activity_chat_rooms link ON link.room_id=r.id
 LEFT JOIN activities a ON a.id=link.activity_id
 WHERE NOT EXISTS(SELECT 1 FROM chat_room_exits x WHERE x.room_id=r.id AND x.member_id=s.member_id)
 GROUP BY t.room_id,s.member_id HAVING MAX(t.can_read OR t.can_post OR t.can_manage)=1
)`

export async function roomRecipients(env: CloudflareBindings, roomId: string) {
  const result = await env.shift_app
    .prepare(`${chatPermissions}
    SELECT u.id,u.display_name AS displayName,e.can_manage AS canManage,identity.image,
    COALESCE(p.muted,0) AS muted FROM chat_permissions e
    JOIN app_users u ON u.id=e.member_id LEFT JOIN user identity ON identity.id=u.user_id
    LEFT JOIN chat_room_preferences p ON p.room_id=e.room_id AND p.member_id=e.member_id
    WHERE e.room_id=? ORDER BY u.student_id`)
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
