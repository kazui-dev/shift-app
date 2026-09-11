import type { QueryClient } from "@tanstack/react-query"
import type { getChatRoom, getChatRooms, getChatMessages } from "@/api/chat"
import { messagesQuery } from "./chat"

type Room = Awaited<ReturnType<typeof getChatRoom>>["room"]
type Message = Awaited<ReturnType<typeof getChatMessages>>["messages"][number]

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
            rooms: current.rooms.map((room) =>
              room.id === id ? change(room) : room
            ),
          }
        : undefined
  )
}

/** Returns false when a missing sequence requires recovery from the server. */
export function receiveMessage(
  client: QueryClient,
  id: string,
  message: Message
) {
  const options = messagesQuery(id)
  const current = client.getQueryData(options.queryKey)
  const latest = current?.pages[0]?.messages.at(-1)?.sequence ?? 0
  const continuous = !!current && message.sequence <= latest + 1
  if (continuous)
    client.setQueryData(options.queryKey, {
      ...current,
      pages: current.pages.map((page, index) => {
        const found = page.messages.some((item) => item.id === message.id)
        if (found)
          return {
            ...page,
            messages: page.messages.map((item) =>
              item.id === message.id ? message : item
            ),
          }
        if (
          index !== 0 ||
          current.pages.some((other) =>
            other.messages.some((item) => item.id === message.id)
          )
        )
          return page
        return {
          ...page,
          messages: [...page.messages, message].sort(
            (a, b) => a.sequence - b.sequence
          ),
        }
      }),
    })
  updateRoom(client, id, (room) => {
    const lastSequence = Math.max(room.lastSequence, message.sequence)
    return {
      ...room,
      lastSequence,
      unreadCount: Math.max(0, lastSequence - room.lastRead),
    }
  })
  return continuous
}
