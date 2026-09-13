import { Hono } from "hono"
import * as v from "valibot"

import { chatImageLimits } from "@workspace/shared/communications"

import { stripWebpMetadata } from "../../domain/chat-image"
import { apiError, errors } from "../../lib/errors"
import type { RoomEnv } from "./room"

const idSchema = v.pipe(v.string(), v.uuid())

export const imagesApp = new Hono<RoomEnv>()

imagesApp.post("/attachments", async (c) => {
  const room = c.get("room"),
    memberId = c.get("member").id
  if (!room.canPost) return apiError(c, errors.chatReadOnly)
  const blob = await c.req.raw.blob()
  if (!blob.size || blob.size > chatImageLimits.bytes)
    return apiError(c, errors.imageTooLarge)
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const reserved = await stub.reserveAttachment(room.id, memberId)
  if (!reserved) return apiError(c, errors.imageLimit)
  try {
    const info = await c.env.IMAGES.info(blob.stream())
    if (
      !("width" in info) ||
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
        "image/avif",
      ].includes(info.format) ||
      info.width * info.height > chatImageLimits.pixels
    ) {
      await stub.deleteAttachment(reserved.id, memberId)
      return apiError(c, errors.invalidImage)
    }
    const result = await c.env.IMAGES.input(blob.stream())
      .transform({ width: 2400, height: 2400, fit: "scale-down" })
      .output({ format: "image/webp", quality: 85, anim: false })
    const bytes = stripWebpMetadata(await result.response().arrayBuffer())
    const output = await c.env.IMAGES.info(new Blob([bytes]).stream())
    if (!("width" in output) || bytes.byteLength > chatImageLimits.bytes)
      throw new Error("Invalid converted image")
    await c.env.CHAT_IMAGES.put(reserved.objectKey, bytes, {
      httpMetadata: { contentType: "image/webp" },
    })
    const attachment = {
      id: reserved.id,
      width: output.width,
      height: output.height,
      bytes: bytes.byteLength,
    }
    if (!(await stub.finishAttachment(reserved.id, memberId, attachment))) {
      await c.env.CHAT_IMAGES.delete(reserved.objectKey)
      return apiError(c, errors.imageExpired)
    }
    return c.json({ attachment }, 201)
  } catch (error) {
    await stub.deleteAttachment(reserved.id, memberId).catch(() => undefined)
    console.error(
      "Chat image conversion failed",
      error instanceof Error ? error.message : "Unknown error"
    )
    return apiError(c, errors.imageProcessingFailed)
  }
})

imagesApp.get("/attachments/:attachmentId", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("attachmentId"))
  if (!id.success) return apiError(c, errors.imageNotFound)
  const attachment = await c.env.CHAT_ROOMS.getByName(
    c.get("room").id
  ).getAttachment(id.output)
  if (!attachment) return apiError(c, errors.imageNotFound)
  const object = await c.env.CHAT_IMAGES.get(attachment.objectKey)
  if (!object) return apiError(c, errors.imageNotFound)
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition": `inline; filename="${id.output}.webp"`,
    },
  })
})

imagesApp.delete("/attachments/:attachmentId", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("attachmentId"))
  if (!id.success) return apiError(c, errors.imageNotFound)
  const removed = await c.env.CHAT_ROOMS.getByName(
    c.get("room").id
  ).deleteAttachment(id.output, c.get("member").id)
  return removed ? c.body(null, 204) : apiError(c, errors.imageNotFound)
})
