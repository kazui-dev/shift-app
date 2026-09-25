import type { ChatMessage } from "../durable-objects/chat-messages"
import { withMemberImages } from "./chat-profiles"
import { messageAudience } from "./private-messages"
import { liveDirectory } from "../../live/services/live-events"
import { notifyRoomMessage } from "../../notifications/services/push"

/** Commit the room's list order and unread index before announcing the message. */
export async function deliverMessage(
  env: CloudflareBindings,
  defer: (task: Promise<unknown>) => void,
  room: { id: string; name: string },
  senderId: string,
  content: string,
  message: ChatMessage
) {
  const db = env.shift_app
  const privateTo = message.privateTo?.memberId ?? null
  const [updated] = await db.batch([
    // Private replies do not move the room in other members' lists.
    // Sending never moves a read position; counts use this separate index.
    db
      .prepare(
        "UPDATE chat_rooms SET updated_at = CASE WHEN ? IS NULL THEN ? ELSE updated_at END, last_sequence = MAX(last_sequence,?) WHERE id = ? AND last_sequence < ?"
      )
      .bind(
        privateTo,
        Date.parse(message.createdAt),
        message.sequence,
        room.id,
        message.sequence
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO chat_message_index(room_id,sequence,member_id,private_to) VALUES(?,?,?,?)"
      )
      .bind(room.id, message.sequence, senderId, privateTo),
  ])
  // Live delivery and push share one resolved audience.
  const audience = await messageAudience(env, room.id, privateTo)
  if (updated && updated.meta.changes > 0)
    defer(
      notifyRoomMessage(
        env,
        audience.devices,
        room.id,
        senderId,
        room.name,
        content || "画像が送信されました"
      )
    )
  const [enriched] = await withMemberImages(env, [message])
  if (enriched)
    defer(
      liveDirectory(env).publish(audience.members, {
        type: "message",
        roomId: room.id,
        message: enriched,
      })
    )
  return enriched
}

export async function markMessageDeleted(
  env: CloudflareBindings,
  roomId: string,
  sequence: number
) {
  await env.shift_app
    .prepare(
      "UPDATE chat_message_index SET deleted=1 WHERE room_id=? AND sequence=?"
    )
    .bind(roomId, sequence)
    .run()
}
