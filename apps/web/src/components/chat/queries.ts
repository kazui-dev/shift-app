import {
  infiniteQueryOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query"
import { getChatMessages, getChatRoom } from "@/api/chat"

export const roomQuery = (id: string) =>
  queryOptions({
    queryKey: ["chat-room", id],
    queryFn: () => getChatRoom(id),
  })
export const messagesQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: ["chat-messages", id],
    queryFn: ({ pageParam }) => getChatMessages(id, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) =>
      last.hasMore ? last.messages[0]?.sequence : undefined,
  })
export function prepareConversation(client: QueryClient, id: string) {
  return Promise.all([
    client.prefetchQuery(roomQuery(id)),
    client.prefetchInfiniteQuery(messagesQuery(id)),
  ])
}
