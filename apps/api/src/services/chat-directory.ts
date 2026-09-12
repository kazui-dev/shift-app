import type { ChatEvent } from "@workspace/shared/communications"
import { roomRecipients } from "./chat-permissions"

export async function publishChatEvent(
  env: CloudflareBindings,
  event: Exclude<ChatEvent, { type: "access_changed" }>
) {
  const members = await roomRecipients(env, event.roomId)
  await env.CHAT_DIRECTORY.getByName("rooms").publish(
    members.map((member) => member.id),
    event
  )
}
export async function roomChangeRecipients(
  env: CloudflareBindings,
  roomId: string
) {
  const [members, former] = await Promise.all([
    roomRecipients(env, roomId),
    env.shift_app
      .prepare("SELECT member_id AS id FROM chat_room_exits WHERE room_id=?")
      .bind(roomId)
      .all<{ id: string }>(),
  ])
  return [
    ...new Set([
      ...members.map((member) => member.id),
      ...former.results.map((member) => member.id),
    ]),
  ]
}
export async function publishRoomChange(
  env: CloudflareBindings,
  roomId: string,
  previous: string[] = []
) {
  const recipients = await roomChangeRecipients(env, roomId)
  await env.CHAT_DIRECTORY.getByName("rooms").publish(
    [...new Set([...previous, ...recipients])],
    { type: "room_changed", roomId }
  )
}
