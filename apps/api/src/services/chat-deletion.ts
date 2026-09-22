import { roomPermissions } from "./chat-permissions"

export async function deleteRoom(
  db: D1Database,
  roomId: string,
  actorId: string
) {
  // A shift's room lives and dies with the shift, so only deleting the shift
  // removes it; otherwise late and absence notices would have nowhere to go.
  const authorized =
    "id=(SELECT id FROM chat_scope) AND EXISTS(SELECT 1 FROM chat_permissions WHERE member_id=? AND can_manage=1) AND NOT EXISTS(SELECT 1 FROM activity_chat_rooms WHERE room_id=chat_rooms.id)"
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
