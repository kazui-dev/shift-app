import {
  infiniteQueryOptions,
  skipToken,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query"
import { keys } from "@/data/keys"
import { messageLinks } from "@workspace/shared/messages"
import { acquireChatImage } from "@/lib/chat/images"
import {
  getChatLinkPreview,
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
export const linkPreviewQuery = (
  roomId: string,
  messageId: string,
  url: string
) =>
  queryOptions({
    queryKey: keys.chatLinkPreview(roomId, messageId, url),
    queryFn: ({ signal }) => getChatLinkPreview(roomId, messageId, signal),
    staleTime: 86_400_000,
    retry: false,
  })

type RecentMessage = {
  id: string
  content: string
  memberImage?: string | null | undefined
  attachments: { id: string }[]
}

/** About one screen of a room: its last 15 messages, up to 6 images and each first link. */
export function warmTargets(messages: readonly RecentMessage[]) {
  const recent = messages.slice(-15)
  return {
    images: recent
      .flatMap((message) => message.attachments.map((image) => image.id))
      .slice(-6),
    avatars: [
      ...new Set(recent.flatMap((message) => message.memberImage ?? [])),
    ],
    links: recent.flatMap((message) => {
      const url = messageLinks(message.content).find((part) => part.href)?.href
      return url ? [{ messageId: message.id, url }] : []
    }),
  }
}

/** Starts the newest screen's images and link cards once its history is known. */
export async function warmConversation(
  client: QueryClient,
  id: string,
  user: string
) {
  const history = await client
    .fetchInfiniteQuery(messagesQuery(id))
    .catch(() => undefined)
  const { images, avatars, links } = warmTargets(
    history?.pages[0]?.messages ?? []
  )
  for (const avatar of avatars) new Image().src = avatar
  for (const image of images) {
    const held = acquireChatImage(user, id, image)
    void held.promise.catch(() => undefined).finally(held.release)
  }
  for (const link of links)
    void client.prefetchQuery(linkPreviewQuery(id, link.messageId, link.url))
}

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
