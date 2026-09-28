import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import { keys, roomKeys } from "../../../app/data/keys"
import type { ChatEvent } from "@workspace/shared/communications"
import type { getChatMembers, getChatMessages } from "@/features/chat/api/chat"
import { forgetImages } from "@/features/chat/lib/image-cache"
import {
  cachedAttachmentIds,
  receiveMessage,
  updateRoom,
  removeRoom,
} from "./chat-cache"

type Messages = InfiniteData<Awaited<ReturnType<typeof getChatMessages>>>
type Members = Awaited<ReturnType<typeof getChatMembers>>

/** Update cached chat views when a member's profile changes. */
export function changeChatProfile(
  client: QueryClient,
  memberId: string,
  image: string | null
) {
  client.setQueriesData<Messages>(
    { queryKey: keys.chatMessages() },
    (current) => {
      if (!current) return current
      const posts = current.pages.flatMap((page) => page.messages)
      const theirs = new Set(
        posts
          .filter((post) => post.memberId === memberId)
          .map((post) => post.id)
      )
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          messages: page.messages.map((message) => ({
            ...message,
            ...(message.memberId === memberId ? { memberImage: image } : {}),
            ...(message.reply && theirs.has(message.reply.id)
              ? { reply: { ...message.reply, memberImage: image } }
              : {}),
          })),
        })),
      }
    }
  )
  client.setQueriesData<Members>(
    { queryKey: keys.chatMembers() },
    (current) =>
      current && {
        ...current,
        members: current.members.map((member) =>
          member.id === memberId ? { ...member, image } : member
        ),
      }
  )
}

export function applyChatEvent(
  client: QueryClient,
  event: ChatEvent | null,
  memberId: string
) {
  // A (re)opened connection may have missed events.
  if (!event) {
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
