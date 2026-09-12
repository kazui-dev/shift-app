export type RoomRow = {
  id: string
  year: number
  name: string
  createdBy: string
  createdAt: number
  updatedAt: number
  kind: "custom" | "global" | "shift"
  activityId: string | null
  activityStartsAt: number | null
  activityEndsAt: number | null
  canPost: number
  canManage: number
  muted: number
  lastRead: number
  lastSequence: number
  exitedAt: number | null
}
export const roomSelection = `SELECT r.id,r.year,r.name,r.created_by AS createdBy,r.created_at AS createdAt,r.updated_at AS updatedAt,r.kind,r.activity_id AS activityId,act.starts_at AS activityStartsAt,act.ends_at AS activityEndsAt,
 COALESCE(e.can_post,0) AS canPost,COALESCE(e.can_manage,0) AS canManage,COALESCE(p.muted,0) AS muted,COALESCE(p.last_read,0) AS lastRead,r.last_sequence AS lastSequence,
 CASE WHEN e.can_read=1 THEN NULL ELSE access.exited_at END AS exitedAt
 FROM chat_rooms r JOIN year_memberships ym ON ym.year=r.year AND ym.member_id=? AND ym.status='active'
 LEFT JOIN activities act ON act.id=r.activity_id
 LEFT JOIN chat_effective_permissions e ON e.room_id=r.id AND e.member_id=ym.member_id
 LEFT JOIN chat_room_access access ON access.room_id=r.id AND access.member_id=ym.member_id
 LEFT JOIN chat_room_preferences p ON p.room_id=r.id AND p.member_id=ym.member_id
 WHERE (e.can_read=1 OR access.room_id IS NOT NULL)`
export function roomJson(room: RoomRow) {
  return {
    ...room,
    historical: room.exitedAt !== null,
    activityStartsAt:
      room.activityStartsAt === null
        ? null
        : new Date(room.activityStartsAt).toISOString(),
    activityEndsAt:
      room.activityEndsAt === null
        ? null
        : new Date(room.activityEndsAt).toISOString(),
    createdAt: new Date(room.createdAt).toISOString(),
    updatedAt: new Date(room.updatedAt).toISOString(),
    canPost: room.canPost === 1,
    canManage: room.canManage === 1,
    muted: room.muted === 1,
    unreadCount:
      room.exitedAt === null
        ? Math.max(0, room.lastSequence - room.lastRead)
        : 0,
  }
}
export async function findAccessibleRoom(
  env: CloudflareBindings,
  id: string,
  memberId: string
) {
  return env.shift_app
    .prepare(`${roomSelection} AND r.id=?`)
    .bind(memberId, id)
    .first<RoomRow>()
}
