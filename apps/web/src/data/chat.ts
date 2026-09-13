import {
  infiniteQueryOptions,
  skipToken,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query"
import { keys } from "@/data/keys"
import { messageLinks } from "@workspace/shared/messages"
import { acquireChatImage } from "@/lib/chat/images"
import { mosaic, tileSizes } from "@/components/chat/image/mosaic"
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
  deleted?: boolean | undefined
  reply?: object | undefined
  memberImage?: string | null | undefined
  attachments: { id: string; width: number; height: number }[]
}

/** Rough pixel sizes of the history, to tell which messages fill a screen. */
const history = {
  message: 44,
  line: 22,
  reply: 22,
  card: 120,
  gap: 4,
  frame: 512,
  gutter: 64,
  character: 15,
}

const firstLink = (content: string) =>
  messageLinks(content).find((part) => part.href)?.href

/** How tall a message's images stand, in the frames the history draws. */
function imagesHeight(
  images: RecentMessage["attachments"],
  width: number
): number {
  const [first] = images
  if (!first) return 0
  const frame = Math.min(history.frame, width)
  if (images.length === 1) {
    const shown = Math.min(
      frame,
      first.width,
      (320 * first.width) / first.height
    )
    return history.gap * 2 + (shown * first.height) / first.width
  }
  const { split, rows } = mosaic(images.length)
  if (split) return history.gap * 2 + (frame * 3) / 4
  return (
    history.gap * (rows.length + 1) +
    rows.reduce(
      (sum, size) => sum + (size === 1 ? (frame * 9) / 16 : frame / size),
      0
    )
  )
}

function messageHeight(message: RecentMessage, width: number) {
  const perLine = Math.max(1, Math.floor(width / history.character))
  const lines = message.content
    ? message.content
        .split("\n")
        .reduce(
          (sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)),
          0
        )
    : 0
  return (
    history.message +
    lines * history.line +
    (message.reply ? history.reply : 0) +
    imagesHeight(message.attachments, width) +
    (firstLink(message.content) ? history.card : 0)
  )
}

/**
 * What a room shows when opened and one screen above it: the newest messages
 * filling two screens, with each image at its tile's size, avatars and links.
 */
export function warmTargets(
  messages: readonly RecentMessage[],
  screen: { width: number; height: number }
) {
  const width = Math.max(160, screen.width - history.gutter)
  const recent: RecentMessage[] = []
  let filled = 0
  for (const message of messages.toReversed()) {
    if (filled >= screen.height * 2) break
    if (message.deleted) continue
    recent.unshift(message)
    filled += messageHeight(message, width)
  }
  return {
    images: recent.flatMap((message) => {
      const sizes = tileSizes(message.attachments.length)
      return message.attachments.map((image, index) => ({
        id: image.id,
        size: sizes[index] ?? 640,
      }))
    }),
    avatars: [
      ...new Set(recent.flatMap((message) => message.memberImage ?? [])),
    ],
    links: recent.flatMap((message) => {
      const url = firstLink(message.content)
      return url ? [{ messageId: message.id, url }] : []
    }),
  }
}

/** Starts a room's first two screens of images and link cards once its history is known. */
export async function warmConversation(
  client: QueryClient,
  id: string,
  user: string
) {
  const loaded = await client
    .fetchInfiniteQuery(messagesQuery(id))
    .catch(() => undefined)
  const { images, avatars, links } = warmTargets(
    loaded?.pages[0]?.messages ?? [],
    { width: Math.min(window.innerWidth, 768), height: window.innerHeight }
  )
  for (const avatar of avatars) new Image().src = avatar
  for (const image of images) {
    const held = acquireChatImage(user, id, image.id, image.size)
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
