import { exports } from "cloudflare:workers"
import * as v from "valibot"

import {
  chatLinkPreviewSchema,
  type ChatImageSize,
} from "@workspace/shared/communications"

/**
 * Asks the cached `SharedCache` entrypoint for a response every member shares.
 * The cache key is the path and query alone, so authorize the member first.
 */
export function sharedResource(
  path: `/v1/${string}`,
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
) => `/v1/chat-images/${roomId}/${attachmentId}/${size}` as const

/** A public page's preview, fetched once for every room that links to it. */
export async function linkPreview(url: string) {
  const response = await sharedResource("/v1/link-previews", { url })
  if (!response.ok) {
    await response.body?.cancel()
    return null
  }
  const parsed = v.safeParse(chatLinkPreviewSchema, await response.json())
  return parsed.success ? parsed.output.preview : null
}
