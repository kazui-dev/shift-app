import { updateRoom } from "@/data/chat-cache"
import { messagesQuery } from "@/data/chat"
import { useCallback, useMemo, useRef } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { updateChatPreferences, type getChatRoom } from "@/api/chat"

type Room = Awaited<ReturnType<typeof getChatRoom>>["room"]
export function useMessages(room: Room, offline: boolean, active: boolean) {
  const client = useQueryClient()
  const initialRead = useRef(room.lastRead),
    readSequence = useRef(room.lastRead)
  const query = useInfiniteQuery({
    ...messagesQuery(room.id),
    enabled: !offline && active,
  })
  const messages = useMemo(
    () => query.data?.pages.toReversed().flatMap((page) => page.messages) ?? [],
    [query.data]
  )
  const markRead = useCallback(() => {
    const sequence = messages.at(-1)?.sequence
    if (
      sequence &&
      !offline &&
      active &&
      !room.historical &&
      document.visibilityState === "visible" &&
      sequence > readSequence.current
    ) {
      readSequence.current = sequence
      void updateChatPreferences(room.id, { lastRead: sequence })
        .then(() => {
          updateRoom(client, room.id, (current) => ({
            ...current,
            lastRead: Math.max(current.lastRead, sequence),
            unreadCount: Math.max(
              0,
              current.lastSequence - Math.max(current.lastRead, sequence)
            ),
          }))
        })
        .catch(() => {
          readSequence.current = room.lastRead
        })
    }
  }, [
    messages,
    offline,
    active,
    room.historical,
    room.id,
    room.lastRead,
    client,
  ])
  return { messages, initialRead: initialRead.current, query, markRead }
}
