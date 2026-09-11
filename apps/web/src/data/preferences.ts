import type { QueryClient } from "@tanstack/react-query"
import { updateChatPreferences } from "@/api/chat"
import { updateRoom } from "./chat-cache"
import { latestWriter } from "./latest-writer"
import { roomQuery } from "./chat"

const writers = new WeakMap<
  QueryClient,
  Map<string, (value: boolean) => Promise<void>>
>()
export function changeRoomMute(
  client: QueryClient,
  id: string,
  muted: boolean
) {
  let rooms = writers.get(client)
  if (!rooms) {
    rooms = new Map()
    writers.set(client, rooms)
  }
  let write = rooms.get(id)
  if (!write) {
    write = latestWriter(
      () => client.getQueryData(roomQuery(id).queryKey)?.room.muted ?? false,
      (value) => updateRoom(client, id, (room) => ({ ...room, muted: value })),
      async (value) => {
        await updateChatPreferences(id, { muted: value })
        return value
      }
    )
    rooms.set(id, write)
  }
  return write(muted)
}
