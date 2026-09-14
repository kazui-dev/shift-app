import { Hono } from "hono"

import { chatImageSizes } from "@workspace/shared/communications"

import {
  chatImageKey,
  chatImageTag,
  chatRoomTag,
} from "../domain/chat-attachment"
import { linkPreview, sharedRoutes } from "../lib/shared-cache"
import { loadLinkImage, loadLinkPreview } from "../services/link-preview"

const day = 86_400
/** A missing page or image may come back, so a failure is kept only briefly. */
const retry = "public, max-age=300"
const imageSizes = new Map(chatImageSizes.map((size) => [String(size), size]))

/** The routes behind the cached `SharedCache` entrypoint. */
export const sharedApp = new Hono<{ Bindings: CloudflareBindings }>()

/** The app's own site, read from its assets rather than over the network. */
const ownSite = (env: CloudflareBindings) => ({
  host: new URL(env.BETTER_AUTH_URL).host,
  assets: env.ASSETS,
})

sharedApp.get(sharedRoutes.linkPreviews, async (c) => {
  const preview = await loadLinkPreview(
    c.req.query("url") ?? "",
    ownSite(c.env)
  )
  c.header("Cache-Control", preview ? `public, max-age=${day}` : retry)
  return c.json({ preview })
})

sharedApp.get(sharedRoutes.linkImages, async (c) => {
  const preview = await linkPreview(c.req.query("url") ?? "")
  const image = preview?.image
    ? await loadLinkImage(c.env.IMAGES, preview.image, ownSite(c.env))
    : null
  if (!image) {
    c.header("Cache-Control", retry)
    return c.body(null, 404)
  }
  c.header("Cache-Control", `public, max-age=${7 * day}`)
  c.header("Content-Type", "image/webp")
  return c.body(image)
})

/** A chat image's original, or a still WebP scaled down to a delivered size. */
sharedApp.get(sharedRoutes.chatImage, async (c) => {
  const { roomId, attachmentId, size } = c.req.param()
  const edge = imageSizes.get(size)
  const object =
    edge || size === "original"
      ? await c.env.CHAT_IMAGES.get(chatImageKey(roomId, attachmentId))
      : null
  if (!object) {
    c.header("Cache-Control", "no-store")
    return c.body(null, 404)
  }
  c.header("Cache-Control", `public, max-age=${30 * day}`)
  c.header("Cache-Tag", `${chatImageTag(attachmentId)},${chatRoomTag(roomId)}`)
  if (!edge) {
    c.header(
      "Content-Type",
      object.httpMetadata?.contentType ?? "application/octet-stream"
    )
    return c.body(object.body)
  }
  const result = await c.env.IMAGES.input(object.body)
    .transform({ width: edge, height: edge, fit: "scale-down" })
    .output({ format: "image/webp", quality: 85, anim: false })
  c.header("Content-Type", "image/webp")
  return c.body(result.image())
})

// A failure must never be cached as the shared response.
sharedApp.onError((error, c) => {
  console.error(
    "Shared resource failed",
    error instanceof Error ? error.message : "Unknown error"
  )
  return c.body(null, 500, { "Cache-Control": "no-store" })
})
