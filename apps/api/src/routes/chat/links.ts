import { Hono } from "hono"
import * as v from "valibot"

import { messageLinks } from "@workspace/shared/communications"

import { apiError, errors } from "../../lib/errors"
import { fetchLink, limitedBody } from "../../services/link-fetch"
import { cachedLinkPreview } from "../../services/link-preview"
import type { RoomEnv } from "./room"

const idSchema = v.pipe(v.string(), v.uuid())
const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]

const digest = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    ),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("")

export const linksApp = new Hono<RoomEnv>()

/** The first link of a message, as the room stored it. */
async function messageLink(
  room: string,
  messageId: string,
  rooms: CloudflareBindings["CHAT_ROOMS"]
) {
  const content = await rooms.getByName(room).messageContent(messageId)
  return content === null
    ? undefined
    : messageLinks(content).find((part) => part.href)?.href
}

linksApp.get("/messages/:messageId/link-preview", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("messageId"))
  if (!id.success) return apiError(c, errors.invalidChatLink)
  const url = await messageLink(c.get("room").id, id.output, c.env.CHAT_ROOMS)
  if (!url) return c.json({ preview: null })
  return c.json({
    preview: await cachedLinkPreview(url, new URL(c.req.url).origin, (work) =>
      c.executionCtx.waitUntil(work)
    ),
  })
})

linksApp.get("/messages/:messageId/link-preview/image", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("messageId"))
  if (!id.success) return apiError(c, errors.invalidChatLink)
  const url = await messageLink(c.get("room").id, id.output, c.env.CHAT_ROOMS)
  const origin = new URL(c.req.url).origin
  const preview = url
    ? await cachedLinkPreview(url, origin, (work) =>
        c.executionCtx.waitUntil(work)
      )
    : null
  if (!preview?.image) return c.body(null, 404)
  try {
    const cache = await caches.open("chat-link-images")
    const key = new Request(
      `${origin}/__link-image/v1/${await digest(preview.image)}`
    )
    const cached = await cache.match(key)
    if (cached) return servedImage(cached.body, cached.headers)
    const { response } = await fetchLink(
      preview.image,
      "image/avif,image/webp,image/png,image/jpeg",
      AbortSignal.timeout(5000)
    )
    const type = response.headers.get("content-type")?.split(";")[0]?.trim()
    if (!type || !imageTypes.includes(type)) {
      await response.body?.cancel()
      return c.body(null, 404)
    }
    const bytes = await limitedBody(response, 4 * 1024 * 1024)
    c.executionCtx.waitUntil(
      cache.put(
        key,
        new Response(bytes, {
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=86400",
          },
        })
      )
    )
    return servedImage(bytes, new Headers({ "Content-Type": type }))
  } catch {
    return c.body(null, 404)
  }
})

function servedImage(body: BodyInit | null, headers: Headers) {
  return new Response(body, {
    headers: {
      "Content-Type": headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
