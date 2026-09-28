import type { QueryClient } from "@tanstack/react-query"
import { keys, roomKeys } from "../../../app/data/keys"
import type {
  getChatRoom,
  getChatRooms,
  getChatMessages,
} from "@/features/chat/api/chat"
import { forgetRoomImages } from "@/features/chat/lib/image-cache"
import { messagesQuery } from "./chat"
import { roomAfterMessage, roomReadThrough } from "./unread"

type Room = Awaited<ReturnType<typeof getChatRoom>>["room"]
type Message = Awaited<ReturnType<typeof getChatMessages>>["messages"][number]

export function removeRoom(client: QueryClient, id: string) {
  client.setQueriesData<Awaited<ReturnType<typeof getChatRooms>>>(
    { queryKey: keys.chatRooms() },
    (current) =>
      current
        ? { rooms: current.rooms.filter((room) => room.id !== id) }
        : undefined
  )
  for (const key of roomKeys) client.removeQueries({ queryKey: key(id) })
  void forgetRoomImages(id)
}

/** Image ids the cache last knew for a message, before an update replaces them. */
export function cachedAttachmentIds(
  client: QueryClient,
  roomId: string,
  messageId: string
) {
  return (
    client
      .getQueryData(messagesQuery(roomId).queryKey)
      ?.pages.flatMap((page) => page.messages)
      .find((message) => message.id === messageId)
      ?.attachments.map((image) => image.id) ?? []
  )
}

export function updateRoom(
  client: QueryClient,
  id: string,
  change: (room: Room) => Room
) {
  client.setQueryData<Awaited<ReturnType<typeof getChatRoom>>>(
    ["chat-room", id],
    (current) => (current ? { room: change(current.room) } : undefined)
  )
  client.setQueriesData<Awaited<ReturnType<typeof getChatRooms>>>(
    { queryKey: keys.chatRooms() },
    (current) =>
      current
        ? {
            rooms: current.rooms
              .map((room) => (room.id === id ? change(room) : room))
              .sort(
                (a, b) =>
                  Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
                  a.id.localeCompare(b.id)
              ),
          }
        : undefined
  )
}

/** Applies a room change the client can know, or asks the server for the room when it cannot. */
function changeRoom(
  client: QueryClient,
  id: string,
  change: (room: Room) => Room | null
) {
  let known = true
  updateRoom(client, id, (room) => {
    const changed = change(room)
    if (changed) return changed
    known = false
    return room
  })
  if (known) return
  void client.invalidateQueries({ queryKey: keys.chatRooms() })
  void client.invalidateQueries({ queryKey: keys.chatRoom(id) })
}

/** Marks a room read through a message, as the server now records. */
export const readRoom = (client: QueryClient, id: string, sequence: number) =>
  changeRoom(client, id, (room) => roomReadThrough(room, sequence))

/** Returns false when a missing sequence requires recovery from the server. */
export function receiveMessage(
  client: QueryClient,
  id: string,
  message: Message,
  memberId: string
) {
  const options = messagesQuery(id)
  const current = client.getQueryData(options.queryKey)
  const latest = current?.pages[0]?.messages.at(-1)?.sequence ?? 0
  const continuous = !!current && message.sequence <= latest + 1
  // A response or event that arrives late never replaces a newer copy.
  const known = current?.pages
    .flatMap((page) => page.messages)
    .find((item) => item.id === message.id)
  const incoming = known && known.version > message.version ? known : message
  if (continuous)
    client.setQueryData(options.queryKey, {
      ...current,
      pages: current.pages.map((page, index) => {
        const messages = page.messages.map((item) => {
          if (item.id === message.id) return incoming
          if (item.reply?.id !== message.id) return item
          return {
            ...item,
            reply: {
              ...item.reply,
              content: incoming.content,
              deleted: incoming.deleted,
              memberImage: incoming.memberImage,
              memberDisplayName: incoming.memberDisplayName,
            },
          }
        })
        const found = page.messages.some((item) => item.id === message.id)
        if (found)
          return {
            ...page,
            messages,
          }
        if (
          index !== 0 ||
          message.sequence <= latest ||
          current.pages.some((other) =>
            other.messages.some((item) => item.id === message.id)
          )
        )
          return { ...page, messages }
        return {
          ...page,
          messages: [...messages, message].sort(
            (a, b) => a.sequence - b.sequence
          ),
        }
      }),
    })
  changeRoom(client, id, (room) => roomAfterMessage(room, message, memberId))
  return continuous
}

export function optimisticallyDeleteMessage(
  client: QueryClient,
  roomId: string,
  id: string
) {
  const key = messagesQuery(roomId).queryKey
  const originals = new Map<string, Message>()
  client.setQueryData(key, (current) =>
    current
      ? {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            messages: page.messages.map((message) => {
              if (message.id !== id && message.reply?.id !== id) return message
              const updated =
                message.id === id
                  ? { ...message, deleted: true, content: "", attachments: [] }
                  : {
                      ...message,
                      reply: message.reply
                        ? { ...message.reply, deleted: true, content: "" }
                        : undefined,
                    }
              originals.set(message.id, message)
              return updated
            }),
          })),
        }
      : undefined
  )
  const applied = new Map(
    client
      .getQueryData(key)
      ?.pages.flatMap((page) =>
        page.messages.map((message) => [message.id, message] as const)
      )
  )
  return () =>
    client.setQueryData(key, (current) =>
      current
        ? {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              messages: page.messages.map((message) =>
                message === applied.get(message.id)
                  ? (originals.get(message.id) ?? message)
                  : message
              ),
            })),
          }
        : undefined
    )
}
