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
  const members = await roomRecipients(env, roomId)
  return members.map((member) => member.id)
}

export async function publishRoomChange(
  env: CloudflareBindings,
  roomId: string,
  previous: string[] = []
) {
  const recipients = await roomChangeRecipients(env, roomId)
  const removed = previous.filter((id) => !recipients.includes(id))
  const directory = env.CHAT_DIRECTORY.getByName("rooms")
  await Promise.all([
    directory.publish(recipients, { type: "room_changed", roomId }),
    ...(removed.length
      ? [directory.publish(removed, { type: "room_removed", roomId })]
      : []),
  ])
}
