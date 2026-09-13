import { roomPermissions } from "./chat-permissions"

export async function deleteRoom(
  db: D1Database,
  roomId: string,
  actorId: string
) {
  const authorized =
    "id=(SELECT id FROM chat_scope) AND EXISTS(SELECT 1 FROM chat_permissions WHERE member_id=? AND can_manage=1)"
  const results = await db.batch([
    db
      .prepare(`${roomPermissions} INSERT OR IGNORE INTO chat_room_deletions(room_id,created_at)
      SELECT id,? FROM chat_rooms WHERE ${authorized}`)
      .bind(roomId, Date.now(), actorId),
    db
      .prepare(
        `${roomPermissions} DELETE FROM chat_rooms WHERE ${authorized} RETURNING id`
      )
      .bind(roomId, actorId),
  ])
  return !!results[1]?.results.length
}
