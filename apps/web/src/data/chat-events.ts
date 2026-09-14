import type { QueryClient } from "@tanstack/react-query"
import { keys, roomKeys } from "./keys"
import type { ChatEvent } from "@workspace/shared/communications"
import { forgetImages } from "@/lib/chat/image-cache"
import {
  cachedAttachmentIds,
  receiveMessage,
  updateRoom,
  removeRoom,
} from "./chat-cache"

export function applyChatEvent(
  client: QueryClient,
  event: ChatEvent | null,
  memberId: string
) {
  if (!event || event.type === "access_changed") {
    for (const key of [keys.chatRooms, ...roomKeys])
      void client.invalidateQueries({ queryKey: key() })
    return
  }
  const id = event.roomId
  if (event.type === "room_removed") {
    removeRoom(client, id)
    return
  }
  if (event.type === "room_changed") {
    void client.invalidateQueries({ queryKey: keys.chatRooms() })
    for (const key of roomKeys)
      void client.invalidateQueries({ queryKey: key(id) })
    return
  }
  if (event.type === "preferences_changed") {
    // The server's count holds for its read position, unless a later one is known.
    updateRoom(client, id, (room) =>
      event.lastRead >= room.lastRead
        ? {
            ...room,
            muted: event.muted,
            lastRead: event.lastRead,
            unreadCount: event.unreadCount,
          }
        : { ...room, muted: event.muted }
    )
    return
  }
  void client.invalidateQueries({ queryKey: keys.chatSearch(id) })
  if (event.type === "message_changed" && event.message.deleted)
    void forgetImages(id, [
      event.message.id,
      ...cachedAttachmentIds(client, id, event.message.id),
    ])
  const continuous = receiveMessage(client, id, event.message, memberId)
  // The event carries the whole message; only a gap needs the history again.
  if (!continuous)
    void client.invalidateQueries({ queryKey: keys.chatMessages(id) })
  if (event.type === "message_changed")
    void client.invalidateQueries({ queryKey: keys.chatImageMessage(id) })
}
