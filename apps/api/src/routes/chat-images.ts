import { Hono } from "hono"
import * as v from "valibot"
import { chatImageLimits } from "@workspace/shared/communications"
import { apiError, type ApiEnv } from "../lib/http"
import { findAccessibleRoom } from "../services/chat-access"
import { stripWebpMetadata } from "../domain/chat-image"

const uuid = v.pipe(v.string(), v.uuid())
export const chatImagesApp = new Hono<ApiEnv>()
chatImagesApp.post("/rooms/:roomId/attachments", async (c) => {
  const id = v.safeParse(uuid, c.req.param("roomId")),
    memberId = c.get("member").id
  if (!id.success)
    return apiError(c, 404, "NOT_FOUND", "ルームが見つかりません。")
  const room = await findAccessibleRoom(c.env, id.output, memberId)
  if (!room?.canPost)
    return apiError(c, 403, "CHAT_READ_ONLY", "このルームには投稿できません。")
  const blob = await c.req.raw.blob()
  if (!blob.size || blob.size > chatImageLimits.bytes)
    return apiError(c, 413, "IMAGE_SIZE", "画像は1枚10MBまでです。")
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const reserved = await stub.reserveAttachment(room.id, memberId)
  if (!reserved)
    return apiError(
      c,
      429,
      "IMAGE_LIMIT",
      "画像のアップロード上限に達しました。時間をおいてお試しください。"
    )
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
      return apiError(
        c,
        422,
        "INVALID_IMAGE",
        "対応する写真・画像を選択してください（最大4000万画素）。"
      )
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
      return apiError(
        c,
        409,
        "IMAGE_EXPIRED",
        "画像をもう一度添付してください。"
      )
    }
    return c.json({ attachment }, 201)
  } catch (error) {
    await stub.deleteAttachment(reserved.id, memberId).catch(() => undefined)
    console.error(
      "Chat image conversion failed",
      error instanceof Error ? error.message : "Unknown error"
    )
    return apiError(
      c,
      422,
      "IMAGE_PROCESSING_FAILED",
      "画像を処理できませんでした。別の画像でお試しください。"
    )
  }
})
chatImagesApp.get("/rooms/:roomId/attachments/:attachmentId", async (c) => {
  const roomId = v.safeParse(uuid, c.req.param("roomId")),
    id = v.safeParse(uuid, c.req.param("attachmentId"))
  if (!roomId.success || !id.success)
    return apiError(c, 404, "NOT_FOUND", "画像が見つかりません。")
  const room = await findAccessibleRoom(
    c.env,
    roomId.output,
    c.get("member").id
  )
  if (!room) return apiError(c, 404, "NOT_FOUND", "画像が見つかりません。")
  const attachment = await c.env.CHAT_ROOMS.getByName(room.id).getAttachment(
    id.output,
    room.exitedAt
  )
  if (!attachment)
    return apiError(c, 404, "NOT_FOUND", "画像が見つかりません。")
  const object = await c.env.CHAT_IMAGES.get(attachment.objectKey)
  if (!object) return apiError(c, 404, "NOT_FOUND", "画像が見つかりません。")
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
chatImagesApp.delete("/rooms/:roomId/attachments/:attachmentId", async (c) => {
  if (
    !v.safeParse(uuid, c.req.param("roomId")).success ||
    !v.safeParse(uuid, c.req.param("attachmentId")).success
  )
    return apiError(c, 404, "NOT_FOUND", "画像が見つかりません。")
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId"),
    c.get("member").id
  )
  if (!room) return apiError(c, 404, "NOT_FOUND", "画像が見つかりません。")
  const removed = await c.env.CHAT_ROOMS.getByName(room.id).deleteAttachment(
    c.req.param("attachmentId"),
    c.get("member").id
  )
  return removed
    ? c.body(null, 204)
    : apiError(c, 404, "NOT_FOUND", "画像が見つかりません。")
})
