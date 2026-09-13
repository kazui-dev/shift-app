import { Hono } from "hono"

import { linkPreview } from "../lib/shared-cache"
import { loadLinkImage, loadLinkPreview } from "../services/link-preview"

const day = 86_400
/** A missing page or image may come back, so a failure is kept only briefly. */
const retry = "public, max-age=300"

/** The routes behind the cached `SharedCache` entrypoint. */
export const sharedApp = new Hono<{ Bindings: CloudflareBindings }>()

sharedApp.get("/v1/link-previews", async (c) => {
  const preview = await loadLinkPreview(c.req.query("url") ?? "")
  c.header("Cache-Control", preview ? `public, max-age=${day}` : retry)
  return c.json({ preview })
})

sharedApp.get("/v1/link-images", async (c) => {
  const preview = await linkPreview(c.req.query("url") ?? "")
  const image = preview?.image
    ? await loadLinkImage(c.env.IMAGES, preview.image)
    : null
  if (!image) {
    c.header("Cache-Control", retry)
    return c.body(null, 404)
  }
  c.header("Cache-Control", `public, max-age=${7 * day}`)
  c.header("Content-Type", "image/webp")
  return c.body(image)
})
