import { chatPermissions } from "./chat-permissions"

export async function deleteRoom(
  db: D1Database,
  roomId: string,
  actorId: string
) {
  const authorized =
    "SELECT 1 FROM chat_permissions WHERE room_id=chat_rooms.id AND member_id=? AND can_manage=1"
  const results = await db.batch([
    db
      .prepare(`${chatPermissions} INSERT OR IGNORE INTO chat_room_deletions(room_id,created_at)
      SELECT id,? FROM chat_rooms WHERE id=? AND EXISTS(${authorized})`)
      .bind(Date.now(), roomId, actorId),
    db
      .prepare(
        `${chatPermissions} DELETE FROM chat_rooms WHERE id=? AND EXISTS(${authorized}) RETURNING id`
      )
      .bind(roomId, actorId),
  ])
  return !!results[1]?.results.length
}
