import { Hono } from "hono"
import * as v from "valibot"

import { messageLinks } from "@workspace/shared/messages"

import { apiError, errors } from "../../lib/errors"
import { privateResponse } from "../../lib/http"
import {
  linkPreview,
  sharedResource,
  sharedRoutes,
} from "../../lib/shared-cache"
import type { RoomEnv } from "./room"

const idSchema = v.pipe(v.string(), v.uuid())

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
  return c.json({ preview: url ? await linkPreview(url) : null })
})

linksApp.get("/messages/:messageId/link-preview/image", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("messageId"))
  if (!id.success) return apiError(c, errors.invalidChatLink)
  const url = await messageLink(c.get("room").id, id.output, c.env.CHAT_ROOMS)
  if (!url) return c.body(null, 404)
  const image = await sharedResource(sharedRoutes.linkImages, { url })
  if (!image.ok) {
    await image.body?.cancel()
    return c.body(null, 404)
  }
  return privateResponse(image.body, { "Content-Type": "image/webp" })
})
