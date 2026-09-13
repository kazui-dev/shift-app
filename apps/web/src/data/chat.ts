import {
  infiniteQueryOptions,
  skipToken,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query"
import { keys } from "@/data/keys"
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
    queryKey: keys.chatRoom(id),
    queryFn: () => getChatRoom(id),
  })
export const messagesQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: keys.chatMessages(id),
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
    queryKey: keys.chatRooms(year),
    queryFn: year === null ? skipToken : () => getChatRooms(year),
    staleTime: 60_000,
  })
export const targetsQuery = (year: number) =>
  queryOptions({
    queryKey: keys.chatTargets(year),
    queryFn: () => getChatTargets(year),
    staleTime: 300_000,
  })
export const settingsQuery = (id: string) =>
  queryOptions({
    queryKey: keys.chatSettings(id),
    queryFn: () => getRoomSettings(id),
    staleTime: 60_000,
  })
export const membersQuery = (id: string) =>
  queryOptions({
    queryKey: keys.chatMembers(id),
    queryFn: () => getChatMembers(id),
    staleTime: 60_000,
  })
