import { Hono } from "hono"
import * as v from "valibot"

import { apiError, errors } from "../../lib/errors"
import { privateResponse } from "../../lib/http"
import { sharedResource, sharedRoutes } from "../../lib/shared-cache"
import type { RoomEnv } from "./room"

const idSchema = v.pipe(v.string(), v.uuid())

export const linksApp = new Hono<RoomEnv>()

/** A message's link card image, for the preview the room stored with it. */
linksApp.get("/messages/:messageId/link-preview/image", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("messageId"))
  if (!id.success) return apiError(c, errors.invalidChatLink)
  const preview = await c.env.CHAT_ROOMS.getByName(
    c.get("room").id
  ).linkPreview(id.output)
  if (!preview?.image) return c.body(null, 404)
  const image = await sharedResource(sharedRoutes.linkImages, {
    url: preview.url,
  })
  if (!image.ok) {
    await image.body?.cancel()
    return c.body(null, 404)
  }
  return privateResponse(image.body, { "Content-Type": "image/webp" })
})
