import type { ChatEvent } from "@workspace/shared/communications"
import { roomRecipients } from "./chat-permissions"

export async function publishChatEvent(
  env: CloudflareBindings,
  event: Exclude<ChatEvent, { type: "access_changed" }>,
  previous: string[] = []
) {
  const members = await roomRecipients(env, event.roomId)
  await env.CHAT_DIRECTORY.getByName("rooms").publish(
    [...new Set([...previous, ...members.map((member) => member.id)])],
    event
  )
}
export function publishRoomChange(
  env: CloudflareBindings,
  roomId: string,
  previous: string[] = []
) {
  return publishChatEvent(env, { type: "room_changed", roomId }, previous)
}
