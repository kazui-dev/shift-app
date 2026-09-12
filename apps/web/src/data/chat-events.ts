import type { QueryClient } from "@tanstack/react-query"
import type { ChatEvent } from "@workspace/shared/communications"
import { receiveMessage, updateRoom, removeRoom } from "./chat-cache"

export function applyChatEvent(
  client: QueryClient,
  event: ChatEvent | null,
  memberId: string
) {
  if (!event || event.type === "access_changed") {
    for (const key of [
      "chat-rooms",
      "chat-room",
      "chat-messages",
      "chat-members",
      "chat-settings",
      "chat-image-message",
    ])
      void client.invalidateQueries({ queryKey: [key] })
    return
  }
  const id = event.roomId
  if (event.type === "room_removed") {
    removeRoom(client, id)
    return
  }
  if (event.type === "room_changed") {
    void client.invalidateQueries({ queryKey: ["chat-rooms"] })
    for (const key of [
      "chat-room",
      "chat-members",
      "chat-settings",
      "chat-messages",
      "chat-image-message",
    ])
      void client.invalidateQueries({ queryKey: [key, id] })
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
  const continuous = receiveMessage(
    client,
    id,
    event.message,
    event.type === "message" && event.message.memberId === memberId
  )
  if (!continuous || event.type === "message_changed")
    void client.invalidateQueries({ queryKey: ["chat-messages", id] })
  if (event.type === "message_changed")
    void client.invalidateQueries({ queryKey: ["chat-image-message", id] })
}
