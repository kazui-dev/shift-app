import type { ChatEvent } from "@workspace/shared/communications"
import { roomRecipients } from "./chat-permissions"
import { liveDirectory } from "../../live/services/live-events"
import { privateReaders } from "./private-messages"

export async function publishChatEvent(
  env: CloudflareBindings,
  event: ChatEvent
) {
  const members = (await roomRecipients(env, event.roomId)).map(
    (member) => member.id
  )
  // A change to a private message reaches only those who may read it.
  const privateTo =
    "message" in event ? (event.message.privateTo?.memberId ?? null) : null
  const recipients = privateTo
    ? (await privateReaders(env, event.roomId, privateTo, members)).members
    : members
  await liveDirectory(env).publish(recipients, event)
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
  const directory = liveDirectory(env)
  await Promise.all([
    directory.publish(recipients, { type: "room_changed", roomId }),
    ...(removed.length
      ? [directory.publish(removed, { type: "room_removed", roomId })]
      : []),
  ])
}
