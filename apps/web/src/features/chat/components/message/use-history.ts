import { readRoom } from "@/features/chat/data/chat-cache"
import { messagesQuery } from "@/features/chat/data/chat"
import { useCallback, useMemo, useRef } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import {
  updateChatPreferences,
  type getChatRoom,
} from "@/features/chat/api/chat"

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
      document.visibilityState === "visible" &&
      sequence > readSequence.current
    ) {
      readSequence.current = sequence
      void updateChatPreferences(room.id, { lastRead: sequence })
        .then(() => readRoom(client, room.id, sequence))
        .catch(() => {
          readSequence.current = room.lastRead
        })
    }
  }, [messages, offline, active, room.id, room.lastRead, client])
  return { messages, initialRead: initialRead.current, query, markRead }
}
