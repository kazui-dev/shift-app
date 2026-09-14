import type { LinkPreview } from "@workspace/shared/communications"

import { linkPreview, sharedResource, sharedRoutes } from "../lib/shared-cache"

/**
 * A link's card as it will show: the page's preview, keeping the image only
 * when a card image could be made from it, which also caches that image.
 * `null` when the page gives no preview.
 */
export async function makeLinkCard(url: string): Promise<LinkPreview | null> {
  const preview = await linkPreview(url)
  if (!preview?.image) return preview
  const image = await sharedResource(sharedRoutes.linkImages, { url })
  await image.body?.cancel()
  return image.ok ? preview : { ...preview, image: null }
}
