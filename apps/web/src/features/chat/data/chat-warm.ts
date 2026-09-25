import type { QueryClient } from "@tanstack/react-query"
import { frameHeight, tileSizes } from "@/features/chat/components/image/frame"
import { messagesQuery } from "@/features/chat/data/chat"
import {
  acquireChatImage,
  acquireLinkImage,
  warmImage,
} from "@/features/chat/lib/images"

type RecentMessage = {
  id: string
  content: string
  deleted?: boolean | undefined
  reply?: object | undefined
  memberImage?: string | null | undefined
  attachments: { id: string; width: number; height: number }[]
  linkPreview: { url: string; image: string | null } | null
}

/** Rough pixel sizes of a history row, to tell which messages fill a screen. */
const row = {
  message: 44,
  line: 22,
  reply: 22,
  card: 120,
  frameMargin: 8,
  gutter: 64,
  character: 15,
}

function messageHeight(message: RecentMessage, width: number) {
  const perLine = Math.max(1, Math.floor(width / row.character))
  const lines = message.content
    ? message.content
        .split("\n")
        .reduce(
          (sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)),
          0
        )
    : 0
  return (
    row.message +
    lines * row.line +
    (message.reply ? row.reply : 0) +
    (message.attachments.length
      ? row.frameMargin + frameHeight(message.attachments, width)
      : 0) +
    (message.linkPreview ? row.card : 0)
  )
}

/**
 * What a room shows when opened and one screen above it: the newest messages
 * filling two screens, with each image at its tile's size, avatars and link
 * card images.
 */
export function warmTargets(
  messages: readonly RecentMessage[],
  screen: { width: number; height: number }
) {
  const width = Math.max(160, screen.width - row.gutter)
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
    links: recent.flatMap((message) =>
      message.linkPreview?.image
        ? [{ messageId: message.id, url: message.linkPreview.url }]
        : []
    ),
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
  for (const image of images)
    warmImage(acquireChatImage(user, id, image.id, image.size))
  for (const link of links)
    warmImage(acquireLinkImage(user, id, link.messageId, link.url))
}
