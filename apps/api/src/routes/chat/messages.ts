import { Hono } from "hono"
import * as v from "valibot"

import {
  editChatMessageInputSchema,
  sendChatMessageInputSchema,
} from "@workspace/shared/communications"

import { apiError, errors } from "../../lib/errors"
import { readJson } from "../../lib/http"
import { publishChatEvent } from "../../services/chat-directory"
import { liveDirectory } from "../../services/live-events"
import { messageAudience } from "../../services/private-messages"
import { withMemberImages } from "../../services/chat-profiles"
import { notifyRoomMessage } from "../../services/push"
import { roomReader, type RoomEnv } from "./room"

const idSchema = v.pipe(v.string(), v.uuid())
const historyQuerySchema = v.object({
  q: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
  before: v.optional(
    v.pipe(v.unknown(), v.toNumber(), v.integer(), v.gtValue(0))
  ),
  limit: v.optional(
    v.pipe(
      v.unknown(),
      v.toNumber(),
      v.integer(),
      v.minValue(1),
      v.maxValue(100)
    ),
    50
  ),
})

/** Attachments and replies are rejected by the room, which owns the history. */
const rejectedSend = [
  "INVALID_CHAT_ATTACHMENTS",
  "MESSAGE_ID_CONFLICT",
  "INVALID_CHAT_REPLY",
]

export const messagesApp = new Hono<RoomEnv>()

messagesApp.get("/messages", async (c) => {
  const query = v.safeParse(historyQuerySchema, c.req.query())
  if (!query.success) return apiError(c, errors.invalidChatRequest)
  const stub = c.env.CHAT_ROOMS.getByName(c.get("room").id)
  const reader = await roomReader(c)
  const history = query.output.q
    ? await stub.searchMessages(
        query.output.q,
        query.output.before ?? null,
        query.output.limit,
        reader
      )
    : await stub.getMessages(
        query.output.before ?? null,
        query.output.limit,
        reader
      )
  return c.json({
    ...history,
    messages: await withMemberImages(c.env, history.messages),
  })
})

messagesApp.post("/messages", async (c) => {
  const input = v.safeParse(
    sendChatMessageInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success)
    return apiError(c, errors.invalidChatMessage, input.issues[0]?.message)
  const room = c.get("room"),
    member = c.get("member")
  if (!room.canPost) return apiError(c, errors.chatReadOnly)
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const message = await stub
    .sendMessage({
      roomId: room.id,
      id: input.output.id,
      memberId: member.id,
      memberDisplayName: member.displayName,
      // Only a reply to a private message needs to know; others skip the lookup.
      readsPrivate:
        !!input.output.replyToId && (await roomReader(c)).readsPrivate,
      content: input.output.content,
      createdAt: Date.now(),
      attachmentIds: input.output.attachmentIds,
      ...(input.output.replyToId ? { replyToId: input.output.replyToId } : {}),
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error)) throw error
      if (error.message === "CHAT_READ_ONLY") return "CHAT_READ_ONLY" as const
      if (rejectedSend.includes(error.message)) return null
      throw error
    })
  if (message === "CHAT_READ_ONLY")
    return apiError(c, errors.chatPostingRevoked)
  if (!message) return apiError(c, errors.invalidChatAttachments)
  const db = c.env.shift_app
  const privateTo = message.privateTo?.memberId ?? null
  const [updated] = await db.batch([
    // A private reply leaves the room's place in everyone's list alone.
    db
      .prepare(
        "UPDATE chat_rooms SET updated_at = CASE WHEN ? IS NULL THEN ? ELSE updated_at END, last_sequence = MAX(last_sequence,?) WHERE id = ? AND last_sequence < ?"
      )
      .bind(
        privateTo,
        Date.parse(message.createdAt),
        message.sequence,
        room.id,
        message.sequence
      ),
    // Unread counts come from this index, so sending never moves a read position.
    db
      .prepare(
        "INSERT OR IGNORE INTO chat_message_index(room_id,sequence,member_id,private_to) VALUES(?,?,?,?)"
      )
      .bind(room.id, message.sequence, member.id, privateTo),
  ])
  // Live delivery and push notifications reach the same people, so they are
  // resolved once here instead of once for each.
  const audience = await messageAudience(c.env, room.id, privateTo)
  if (updated && updated.meta.changes > 0)
    c.executionCtx.waitUntil(
      notifyRoomMessage(
        c.env,
        audience.devices,
        room.id,
        member.id,
        room.name,
        input.output.content || "画像が送信されました"
      )
    )
  const [enriched] = await withMemberImages(c.env, [message])
  if (enriched)
    c.executionCtx.waitUntil(
      liveDirectory(c.env).publish(audience.members, {
        type: "message",
        roomId: room.id,
        message: enriched,
      })
    )
  return c.json({ message: enriched }, 201)
})

for (const method of ["patch", "delete"] as const) {
  messagesApp[method]("/messages/:messageId", async (c) => {
    const id = v.safeParse(idSchema, c.req.param("messageId"))
    if (!id.success) return apiError(c, errors.messageNotFound)
    let content: string | undefined
    if (method === "patch") {
      const input = v.safeParse(
        editChatMessageInputSchema,
        await readJson(c.req.raw)
      )
      if (!input.success) return apiError(c, errors.invalidMessageContent)
      content = input.output.content
    }
    const roomId = c.get("room").id
    const reader = await roomReader(c)
    const result = await c.env.CHAT_ROOMS.getByName(roomId).changeMessage({
      roomId,
      id: id.output,
      ...reader,
      ...(content === undefined ? {} : { content }),
    })
    if ("error" in result) {
      if (result.error === "not_found")
        return apiError(c, errors.messageNotFound)
      if (result.error === "forbidden")
        return apiError(c, errors.messageForbidden)
      return apiError(c, errors.emptyMessage)
    }
    if (result.changed && result.message.deleted)
      await c.env.shift_app
        .prepare(
          "UPDATE chat_message_index SET deleted=1 WHERE room_id=? AND sequence=?"
        )
        .bind(roomId, result.message.sequence)
        .run()
    const [message] = await withMemberImages(c.env, [result.message])
    if (message && result.changed)
      c.executionCtx.waitUntil(
        publishChatEvent(c.env, {
          type: "message_changed",
          roomId,
          message,
        })
      )
    return c.json({ message })
  })
}
