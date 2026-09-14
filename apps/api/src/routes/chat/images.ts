import { Hono } from "hono"
import * as v from "valibot"

import {
  chatImageLimits,
  chatImageSizes,
  type ChatImageSize,
} from "@workspace/shared/communications"

import {
  attachmentName,
  chatImageTag,
  dailyUploadLimit,
} from "../../domain/chat-attachment"
import { apiError, errors } from "../../lib/errors"
import { privateResponse } from "../../lib/http"
import {
  purgeShared,
  chatImagePath,
  sharedResource,
  warmShared,
} from "../../lib/shared-cache"
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
    member = c.get("member"),
    memberId = member.id
  if (!room.canPost) return apiError(c, errors.chatReadOnly)
  // Each step's duration goes out as Server-Timing, so slow uploads can be read from the client.
  const timings: string[] = []
  let mark = Date.now()
  const lap = (name: string) => {
    const now = Date.now()
    timings.push(`${name};dur=${now - mark}`)
    mark = now
  }
  const blob = await c.req.raw.blob()
  lap("body")
  if (!blob.size || blob.size > chatImageLimits.bytes)
    return apiError(c, errors.imageTooLarge)
  // A display copy is sent first; its original follows to `/original`.
  const copy = c.req.query("copy") === "1"
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const reserved = await stub.reserveAttachment(
    room.id,
    memberId,
    blob.size,
    dailyUploadLimit(member.accessLevel, room.canManage === 1),
    copy
  )
  lap("reserve")
  if (!reserved) return apiError(c, errors.imageLimit)
  try {
    const image = await storableImage(c.env.IMAGES, blob)
    lap("image")
    if (!image) {
      await stub.deleteAttachment(reserved.id, memberId)
      return apiError(c, errors.invalidImage)
    }
    await c.env.CHAT_IMAGES.put(reserved.objectKey, image.bytes, {
      httpMetadata: { contentType: image.type },
    })
    lap("store")
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
    lap("finish")
    c.header("Server-Timing", timings.join(", "))
    c.executionCtx.waitUntil(
      Promise.all(
        tileSizes.map((size) =>
          warmShared(chatImagePath(room.id, reserved.id, size))
        )
      )
    )
    return c.json({ attachment: { ...attachment, original: !copy } }, 201)
  } catch (error) {
    await stub.deleteAttachment(reserved.id, memberId).catch(() => undefined)
    console.error(
      "Chat image upload failed",
      error instanceof Error ? error.message : "Unknown error"
    )
    return apiError(c, errors.imageProcessingFailed)
  }
})

/** The original of a display copy sent first, taking the copy's place. */
imagesApp.put("/attachments/:attachmentId/original", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("attachmentId"))
  if (!id.success) return apiError(c, errors.imageNotFound)
  const room = c.get("room"),
    member = c.get("member")
  const blob = await c.req.raw.blob()
  if (!blob.size || blob.size > chatImageLimits.bytes)
    return apiError(c, errors.imageTooLarge)
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const reserved = await stub.reserveOriginal(
    id.output,
    member.id,
    blob.size,
    dailyUploadLimit(member.accessLevel, room.canManage === 1)
  )
  if (reserved === "missing") return apiError(c, errors.imageNotFound)
  if (reserved === "limit") return apiError(c, errors.imageLimit)
  try {
    const image = await storableImage(c.env.IMAGES, blob)
    if (!image) return apiError(c, errors.invalidImage)
    await c.env.CHAT_IMAGES.put(reserved.objectKey, image.bytes, {
      httpMetadata: { contentType: image.type },
    })
    const stored = await stub.finishOriginal(room.id, id.output, member.id, {
      width: image.width,
      height: image.height,
      bytes: image.bytes.byteLength,
      name: attachmentName(c.req.query("name") ?? "", image.type),
      type: image.type,
    })
    if (!stored) return apiError(c, errors.imageNotFound)
    // Sizes made from the copy give way to ones made from the original.
    c.executionCtx.waitUntil(
      purgeShared([chatImageTag(id.output)]).then(() =>
        Promise.all(
          tileSizes.map((size) =>
            warmShared(chatImagePath(room.id, id.output, size))
          )
        )
      )
    )
    return c.body(null, 204)
  } catch (error) {
    console.error(
      "Chat original upload failed",
      error instanceof Error ? error.message : "Unknown error"
    )
    return apiError(c, errors.imageProcessingFailed)
  }
})

/** Gives up a display copy's original, so the copy stands as it. */
imagesApp.delete("/attachments/:attachmentId/original", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("attachmentId"))
  if (!id.success) return apiError(c, errors.imageNotFound)
  const room = c.get("room")
  const kept = await c.env.CHAT_ROOMS.getByName(room.id).keepCopy(
    room.id,
    id.output,
    c.get("member").id
  )
  return kept ? c.body(null, 204) : apiError(c, errors.imageNotFound)
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
  return privateResponse(image.body, {
    "Content-Type": size.output ? "image/webp" : attachment.type,
    "Content-Disposition": size.output
      ? "inline"
      : `attachment; filename*=UTF-8''${encodedFileName(attachment.name)}`,
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
