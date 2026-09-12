import { roomRecipients } from "./chat-permissions"
export async function publishRoomChange(
  env: CloudflareBindings,
  roomId: string
) {
  const members = await roomRecipients(env, roomId)
  await env.CHAT_DIRECTORY.getByName("rooms").publish(
    members.map((member) => member.id)
  )
}
