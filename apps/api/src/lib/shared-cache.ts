import { exports } from "cloudflare:workers"
import * as v from "valibot"

import { chatLinkPreviewSchema } from "@workspace/shared/communications"

/**
 * Asks the cached `SharedCache` entrypoint for a response every member shares.
 * The cache key is the path and query alone, so authorize the member first.
 */
export function sharedResource(
  path: `/v1/${string}`,
  query: Record<string, string>
) {
  const url = new URL(path, "https://shared.cache")
  for (const [name, value] of Object.entries(query))
    url.searchParams.set(name, value)
  return exports.SharedCache.fetch(url)
}

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
