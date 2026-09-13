import { exports } from "cloudflare:workers"
import * as v from "valibot"

import {
  chatLinkPreviewSchema,
  type ChatImageSize,
} from "@workspace/shared/communications"

/** The routes of `SharedCache`, shared by its router and by those who call it. */
export const sharedRoutes = {
  linkPreviews: "/v1/link-previews",
  linkImages: "/v1/link-images",
  chatImage: "/v1/chat-images/:roomId/:attachmentId/:size",
} as const

/**
 * Asks the cached `SharedCache` entrypoint for a response every member shares.
 * The cache key is the path and query alone, so authorize the member first.
 */
export function sharedResource(
  path: string,
  query: Record<string, string> = {}
) {
  const url = new URL(path, "https://shared.cache")
  for (const [name, value] of Object.entries(query))
    url.searchParams.set(name, value)
  return exports.SharedCache.fetch(url)
}

/** Drops shared responses carrying any of the cache tags. */
export function purgeShared(tags: string[]) {
  return exports.SharedCache.purge(tags)
}

/** Where `SharedCache` serves a chat image: a delivered size or the original. */
export const chatImagePath = (
  roomId: string,
  attachmentId: string,
  size: ChatImageSize | "original"
) =>
  sharedRoutes.chatImage
    .replace(":roomId", roomId)
    .replace(":attachmentId", attachmentId)
    .replace(":size", String(size))

/** A public page's preview, fetched once for every room that links to it. */
export async function linkPreview(url: string) {
  const response = await sharedResource(sharedRoutes.linkPreviews, { url })
  if (!response.ok) {
    await response.body?.cancel()
    return null
  }
  const parsed = v.safeParse(chatLinkPreviewSchema, await response.json())
  return parsed.success ? parsed.output.preview : null
}
