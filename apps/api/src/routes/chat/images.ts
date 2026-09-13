import { Hono } from "hono"
import * as v from "valibot"

import {
  chatImageLimits,
  chatImageSizes,
  type ChatImageSize,
} from "@workspace/shared/communications"

import { attachmentName } from "../../domain/chat-attachment"
import { apiError, errors } from "../../lib/errors"
import { chatImagePath, sharedResource } from "../../lib/shared-cache"
import { storableImage } from "../../services/chat-image"
import type { RoomEnv } from "./room"

const idSchema = v.pipe(v.string(), v.uuid())
const sizeSchema = v.optional(
  v.pipe(v.string(), v.transform(Number), v.picklist(chatImageSizes))
)
/** The sizes list tiles use, made as soon as an image is uploaded. */
const tileSizes: ChatImageSize[] = [640, 1280]

/** A filename in a Content-Disposition header (RFC 6266 and 8187). */
const encodedFileName = (name: string) =>
  encodeURIComponent(name).replace(
    /['()]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
  )

export const imagesApp = new Hono<RoomEnv>()

imagesApp.post("/attachments", async (c) => {
  const room = c.get("room"),
    memberId = c.get("member").id
  if (!room.canPost) return apiError(c, errors.chatReadOnly)
  const blob = await c.req.raw.blob()
  if (!blob.size || blob.size > chatImageLimits.bytes)
    return apiError(c, errors.imageTooLarge)
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const reserved = await stub.reserveAttachment(room.id, memberId, blob.size)
  if (!reserved) return apiError(c, errors.imageLimit)
  try {
    const image = await storableImage(c.env.IMAGES, blob)
    if (!image) {
      await stub.deleteAttachment(reserved.id, memberId)
      return apiError(c, errors.invalidImage)
    }
    await c.env.CHAT_IMAGES.put(reserved.objectKey, image.bytes, {
      httpMetadata: { contentType: image.type },
    })
    const attachment = {
      id: reserved.id,
      width: image.width,
      height: image.height,
      bytes: image.bytes.byteLength,
      name: attachmentName(c.req.query("name") ?? "", image.type),
    }
    if (
      !(await stub.finishAttachment(reserved.id, memberId, {
        ...attachment,
        type: image.type,
      }))
    ) {
      await c.env.CHAT_IMAGES.delete(reserved.objectKey)
      return apiError(c, errors.imageExpired)
    }
    c.executionCtx.waitUntil(
      Promise.all(
        tileSizes.map(async (size) => {
          const tile = await sharedResource(
            chatImagePath(room.id, reserved.id, size)
          )
          await tile.body?.cancel()
        })
      )
    )
    return c.json({ attachment }, 201)
  } catch (error) {
    await stub.deleteAttachment(reserved.id, memberId).catch(() => undefined)
    console.error(
      "Chat image upload failed",
      error instanceof Error ? error.message : "Unknown error"
    )
    return apiError(c, errors.imageProcessingFailed)
  }
})

imagesApp.get("/attachments/:attachmentId", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("attachmentId"))
  const size = v.safeParse(sizeSchema, c.req.query("size"))
  if (!id.success || !size.success) return apiError(c, errors.imageNotFound)
  const room = c.get("room")
  const attachment = await c.env.CHAT_ROOMS.getByName(room.id).getAttachment(
    id.output
  )
  if (!attachment) return apiError(c, errors.imageNotFound)
  const image = await sharedResource(
    chatImagePath(room.id, id.output, size.output ?? "original")
  )
  if (!image.ok) {
    await image.body?.cancel()
    return apiError(c, errors.imageNotFound)
  }
  return new Response(image.body, {
    headers: {
      "Content-Type": size.output ? "image/webp" : attachment.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition": size.output
        ? "inline"
        : `attachment; filename*=UTF-8''${encodedFileName(attachment.name)}`,
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
