import type { QueryClient } from "@tanstack/react-query"
import type { getChatRoom, getChatRooms, getChatMessages } from "@/api/chat"
import { messagesQuery } from "./chat"

type Room = Awaited<ReturnType<typeof getChatRoom>>["room"]
type Message = Awaited<ReturnType<typeof getChatMessages>>["messages"][number]

export function removeRoom(client: QueryClient, id: string) {
  client.setQueriesData<Awaited<ReturnType<typeof getChatRooms>>>(
    { queryKey: ["chat-rooms"] },
    (current) =>
      current
        ? { rooms: current.rooms.filter((room) => room.id !== id) }
        : undefined
  )
  for (const root of [
    "chat-room",
    "chat-messages",
    "chat-members",
    "chat-settings",
    "chat-search",
    "chat-link-preview",
    "chat-image-message",
  ])
    client.removeQueries({ queryKey: [root, id] })
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
    { queryKey: ["chat-rooms"] },
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

/** Returns false when a missing sequence requires recovery from the server. */
export function receiveMessage(
  client: QueryClient,
  id: string,
  message: Message,
  read = false
) {
  const options = messagesQuery(id)
  const current = client.getQueryData(options.queryKey)
  const latest = current?.pages[0]?.messages.at(-1)?.sequence ?? 0
  const continuous = !!current && message.sequence <= latest + 1
  if (continuous)
    client.setQueryData(options.queryKey, {
      ...current,
      pages: current.pages.map((page, index) => {
        const messages = page.messages.map((item) => {
          if (item.id === message.id) return message
          if (item.reply?.id !== message.id) return item
          return {
            ...item,
            reply: {
              ...item.reply,
              content: message.content,
              deleted: message.deleted,
              memberImage: message.memberImage,
              memberDisplayName: message.memberDisplayName,
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
  updateRoom(client, id, (room) => {
    const lastSequence = Math.max(room.lastSequence, message.sequence)
    const lastRead = read
      ? Math.max(room.lastRead, message.sequence)
      : room.lastRead
    return {
      ...room,
      updatedAt:
        message.sequence > room.lastSequence
          ? message.createdAt
          : room.updatedAt,
      lastSequence,
      lastRead,
      unreadCount: Math.max(0, lastSequence - lastRead),
    }
  })
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
