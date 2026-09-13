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
    updateRoom(client, id, (room) => ({
      ...room,
      muted: event.muted,
      lastRead: Math.max(room.lastRead, event.lastRead),
      unreadCount: Math.max(
        0,
        room.lastSequence - Math.max(room.lastRead, event.lastRead)
      ),
    }))
    return
  }
  void client.invalidateQueries({ queryKey: keys.chatSearch(id) })
  if (event.type === "message_changed" && event.message.deleted)
    void forgetImages(id, [
      event.message.id,
      ...cachedAttachmentIds(client, id, event.message.id),
    ])
  const continuous = receiveMessage(
    client,
    id,
    event.message,
    event.type === "message" && event.message.memberId === memberId
  )
  if (!continuous || event.type === "message_changed")
    void client.invalidateQueries({ queryKey: keys.chatMessages(id) })
  if (event.type === "message_changed")
    void client.invalidateQueries({ queryKey: keys.chatImageMessage(id) })
}
