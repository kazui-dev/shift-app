import {
  infiniteQueryOptions,
  skipToken,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query"
import {
  getChatMessages,
  getChatRoom,
  getChatRooms,
  getChatTargets,
  getRoomSettings,
  getChatMembers,
} from "@/api/chat"

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

export const roomsQuery = (year: number | null) =>
  queryOptions({
    queryKey: ["chat-rooms", year],
    queryFn: year === null ? skipToken : () => getChatRooms(year),
    staleTime: 60_000,
  })
export const targetsQuery = (year: number) =>
  queryOptions({
    queryKey: ["chat-targets", year],
    queryFn: () => getChatTargets(year),
    staleTime: 300_000,
  })
export const settingsQuery = (id: string) =>
  queryOptions({
    queryKey: ["chat-settings", id],
    queryFn: () => getRoomSettings(id),
    staleTime: 60_000,
  })
export const membersQuery = (id: string) =>
  queryOptions({
    queryKey: ["chat-members", id],
    queryFn: () => getChatMembers(id),
    staleTime: 60_000,
  })
