import { Hono } from "hono"
import * as v from "valibot"
import { messageLinks } from "@workspace/shared/communications"
import { apiError, errors } from "../lib/errors"
import { type ApiEnv } from "../lib/http"
import { findAccessibleRoom } from "../services/chat-access"
import { cachedLinkPreview } from "../services/link-preview"
import { fetchLink, limitedBody } from "../services/link-fetch"
const paramsSchema = v.object({
  roomId: v.pipe(v.string(), v.uuid()),
  messageId: v.pipe(v.string(), v.uuid()),
})
export const chatLinksApp = new Hono<ApiEnv>()
chatLinksApp.get(
  "/rooms/:roomId/messages/:messageId/link-preview/:asset?",
  async (c) => {
    const params = v.safeParse(paramsSchema, c.req.param())
    if (
      !params.success ||
      (c.req.param("asset") && c.req.param("asset") !== "image")
    )
      return apiError(c, errors.invalidChatLink)
    const room = await findAccessibleRoom(
      c.env,
      params.output.roomId,
      c.get("member").id
    )
    if (!room) return apiError(c, errors.chatRoomNotFound)
    const content = await c.env.CHAT_ROOMS.getByName(room.id).messageContent(
      params.output.messageId
    )
    const url =
      content === null
        ? undefined
        : messageLinks(content).find((part) => part.href)?.href
    if (!url) return c.json({ preview: null })
    const preview = await cachedLinkPreview(
      url,
      new URL(c.req.url).origin,
      (work) => c.executionCtx.waitUntil(work)
    )
    if (!c.req.param("asset")) return c.json({ preview })
    if (!preview?.image) return c.body(null, 404)
    try {
      const cache = await caches.open("chat-link-images")
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(preview.image)
      )
      const key = new Request(
        `${new URL(c.req.url).origin}/__link-image/v1/${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`
      )
      const cached = await cache.match(key)
      if (cached)
        return new Response(cached.body, {
          headers: {
            "Content-Type": cached.headers.get("Content-Type") ?? "image/webp",
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
          },
        })
      const { response } = await fetchLink(
        preview.image,
        "image/avif,image/webp,image/png,image/jpeg",
        AbortSignal.timeout(5000)
      )
      const type = response.headers.get("content-type")?.split(";")[0]?.trim()
      if (
        !type ||
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/avif",
          "image/gif",
        ].includes(type)
      ) {
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
      return new Response(bytes, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch {
      return c.body(null, 404)
    }
  }
)
