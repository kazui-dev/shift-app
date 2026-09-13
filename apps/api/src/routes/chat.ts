import { chatLinksApp } from "./chat-links"
import {
  publishChatEvent,
  publishRoomChange,
  roomChangeRecipients,
} from "../services/chat-directory"
import { editChatMessageInputSchema } from "@workspace/shared/communications"
import { saveRoomSettings } from "../services/chat-settings"
import { deleteRoom } from "../services/chat-deletion"
import { targetExists } from "../services/chat-targets"
import { roomRecipients, chatPermissions } from "../services/chat-permissions"
import { withMemberImages } from "../services/chat-profiles"
import { notifyRoomMessage } from "../services/push"
import {
  roomSelection,
  roomJson,
  findAccessibleRoom,
  type RoomRow,
} from "../services/chat-access"
import { Hono } from "hono"
import * as v from "valibot"

import {
  createChatRoomInputSchema,
  chatPreferencesInputSchema,
  roomSettingsInputSchema,
  sendChatMessageInputSchema,
} from "@workspace/shared/communications"

import { apiError, errors } from "../lib/errors"
import {
  type ApiEnv,
  hasActiveYearMembership,
  readJson,
  parseYear,
} from "../lib/http"

const idSchema = v.pipe(v.string(), v.uuid())
const messagesQuerySchema = v.object({
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

export const chatApp = new Hono<ApiEnv>()
chatApp.route("/", chatLinksApp)

chatApp.get("/rooms", async (c) => {
  const year = parseYear(c.req.query("year") ?? "")
  if (year === null) return apiError(c, errors.yearRequired)
  const member = c.get("member")
  const rooms = await c.env.shift_app
    .prepare(
      `${roomSelection} AND r.year=? ORDER BY r.updated_at DESC,r.id ASC LIMIT 200`
    )
    .bind(member.id, year)
    .all<RoomRow>()

  return c.json({ rooms: rooms.results.map(roomJson) })
})

chatApp.get("/rooms/:roomId", async (c) => {
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId"),
    c.get("member").id
  )
  return room
    ? c.json({ room: roomJson(room) })
    : apiError(c, errors.chatRoomNotFound)
})

chatApp.delete("/rooms/:roomId", async (c) => {
  const actor = c.get("member")
  const room = await findAccessibleRoom(c.env, c.req.param("roomId"), actor.id)
  if (!room) return apiError(c, errors.chatRoomNotFound)
  if (!room.canManage) return apiError(c, errors.chatManagementRequired)
  const previous = await roomChangeRecipients(c.env, room.id)
  const deleted = await deleteRoom(c.env.shift_app, room.id, actor.id)
  if (!deleted) return apiError(c, errors.chatSettingsChanged)
  c.executionCtx.waitUntil(publishRoomChange(c.env, room.id, previous))
  return c.body(null, 204)
})

chatApp.get("/rooms/:roomId/members", async (c) => {
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId"),
    c.get("member").id
  )
  if (!room) return apiError(c, errors.chatMembersUnavailable)
  const members = await roomRecipients(c.env, room.id)
  return c.json({
    members: members.map(({ muted: _muted, ...member }) => ({
      ...member,
      canManage: member.canManage === 1,
    })),
  })
})

chatApp.get("/events", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
    return c.text("Expected WebSocket", 426)
  if (c.req.header("Origin") !== c.env.BETTER_AUTH_URL)
    return apiError(c, errors.forbiddenOrigin)
  const headers = new Headers({
    Upgrade: "websocket",
    "X-Chat-Member-Id": c.get("member").id,
  })
  return c.env.CHAT_DIRECTORY.getByName("rooms").fetch(
    new Request(c.req.url, { headers })
  )
})

chatApp.post("/rooms", async (c) => {
  const input = v.safeParse(
    createChatRoomInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(c, errors.invalidChatRoom, input.issues[0]?.message)
  }
  const actor = c.get("member")
  if (!(await hasActiveYearMembership(c.env, actor.id, input.output.year))) {
    return apiError(c, errors.yearMembershipRequired)
  }
  const targets = [
    ...new Map(
      input.output.targets.map((target) => [
        `${target.targetType}:${target.targetId}`,
        target,
      ])
    ).values(),
  ]
  const validTargets = await Promise.all(
    targets.map((target) => targetExists(c.env, input.output.year, target))
  )
  if (validTargets.some((valid) => !valid)) {
    return apiError(c, errors.invalidChatTarget)
  }

  const roomId = crypto.randomUUID()
  const now = Date.now()
  const statements = [
    c.env.shift_app
      .prepare(
        `INSERT INTO chat_rooms
          (id, year, name, created_by, created_at, updated_at)
         SELECT ?, year, ?, ?, ?, ?
         FROM operating_years WHERE year = ? RETURNING id`
      )
      .bind(roomId, input.output.name, actor.id, now, now, input.output.year),
    c.env.shift_app
      .prepare(
        "INSERT INTO chat_room_targets (room_id,target_type,target_id,can_read,can_post,can_manage,created_at) SELECT ?,'member',?,1,1,1,? WHERE EXISTS(SELECT 1 FROM chat_rooms WHERE id=?)"
      )
      .bind(roomId, actor.id, now, roomId),
    ...targets
      .filter(
        (target) =>
          !(target.targetType === "member" && target.targetId === actor.id)
      )
      .map((target) =>
        c.env.shift_app
          .prepare(
            `INSERT INTO chat_room_targets
            (room_id, target_type, target_id, created_at)
           SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM chat_rooms WHERE id = ?)`
          )
          .bind(roomId, target.targetType, target.targetId, now, roomId)
      ),
  ]
  const results = await c.env.shift_app.batch(statements)
  if (!results[0]?.results.length) {
    return apiError(c, errors.yearNotFound)
  }
  const created = await findAccessibleRoom(c.env, roomId, actor.id)
  if (!created) return apiError(c, errors.chatRoomCreateFailed)
  c.executionCtx.waitUntil(publishRoomChange(c.env, roomId))
  return c.json({ room: roomJson(created) }, 201)
})

chatApp.get("/rooms/:roomId/messages", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("roomId"))
  const query = v.safeParse(messagesQuerySchema, c.req.query())
  if (!id.success || !query.success) {
    return apiError(c, errors.invalidChatRequest)
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.output, member.id)
  if (!room) {
    return apiError(c, errors.chatRoomNotFound)
  }
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const history = query.output.q
    ? await stub.searchMessages(
        query.output.q,
        query.output.before ?? null,
        query.output.limit
      )
    : await stub.getMessages(query.output.before ?? null, query.output.limit)
  return c.json({
    ...history,
    messages: await withMemberImages(c.env, history.messages),
  })
})

chatApp.post("/rooms/:roomId/messages", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("roomId"))
  if (!id.success) {
    return apiError(c, errors.chatRoomNotFound)
  }
  const input = v.safeParse(
    sendChatMessageInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(c, errors.invalidChatMessage, input.issues[0]?.message)
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.output, member.id)
  if (!room) {
    return apiError(c, errors.chatRoomNotFound)
  }
  if (!room.canPost) return apiError(c, errors.chatReadOnly)
  const now = Date.now()
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const message = await stub
    .sendMessage({
      roomId: room.id,
      id: input.output.id,
      memberId: member.id,
      memberDisplayName: member.displayName,
      content: input.output.content,
      createdAt: now,
      attachmentIds: input.output.attachmentIds,
      ...(input.output.replyToId ? { replyToId: input.output.replyToId } : {}),
    })
    .catch((error) => {
      if (error instanceof Error && error.message === "CHAT_READ_ONLY")
        return "CHAT_READ_ONLY" as const
      if (
        error instanceof Error &&
        [
          "INVALID_CHAT_ATTACHMENTS",
          "MESSAGE_ID_CONFLICT",
          "INVALID_CHAT_REPLY",
        ].includes(error.message)
      )
        return null
      throw error
    })
  if (message === "CHAT_READ_ONLY")
    return apiError(c, errors.chatPostingRevoked)
  if (!message) return apiError(c, errors.invalidChatAttachments)
  const updated = await c.env.shift_app
    .prepare(
      "UPDATE chat_rooms SET updated_at = ?, last_sequence = MAX(last_sequence,?) WHERE id = ? AND last_sequence < ?"
    )
    .bind(
      Date.parse(message.createdAt),
      message.sequence,
      room.id,
      message.sequence
    )
    .run()
  if (updated.meta.changes > 0)
    c.executionCtx.waitUntil(
      notifyRoomMessage(
        c.env,
        room.id,
        member.id,
        room.name,
        input.output.content || "画像が送信されました"
      )
    )
  await c.env.shift_app
    .prepare(
      "INSERT INTO chat_room_preferences(room_id,member_id,last_read) VALUES(?,?,?) ON CONFLICT(room_id,member_id) DO UPDATE SET last_read=MAX(last_read,excluded.last_read)"
    )
    .bind(room.id, member.id, message.sequence)
    .run()
  const [enriched] = await withMemberImages(c.env, [message])
  if (enriched)
    c.executionCtx.waitUntil(
      publishChatEvent(c.env, {
        type: "message",
        roomId: room.id,
        message: enriched,
      })
    )
  return c.json({ message: enriched }, 201)
})

for (const method of ["patch", "delete"] as const) {
  chatApp[method]("/rooms/:roomId/messages/:messageId", async (c) => {
    const roomId = v.safeParse(idSchema, c.req.param("roomId")),
      id = v.safeParse(idSchema, c.req.param("messageId"))
    if (!roomId.success || !id.success)
      return apiError(c, errors.messageNotFound)
    let content: string | undefined
    if (method === "patch") {
      const input = v.safeParse(
        editChatMessageInputSchema,
        await readJson(c.req.raw)
      )
      if (!input.success) return apiError(c, errors.invalidMessageContent)
      content = input.output.content
    }
    const result = await c.env.CHAT_ROOMS.getByName(
      roomId.output
    ).changeMessage({
      roomId: roomId.output,
      id: id.output,
      memberId: c.get("member").id,
      ...(content === undefined ? {} : { content }),
    })
    if ("error" in result) {
      if (result.error === "not_found")
        return apiError(c, errors.messageNotFound)
      if (result.error === "forbidden")
        return apiError(c, errors.messageForbidden)
      return apiError(c, errors.emptyMessage)
    }
    const [message] = await withMemberImages(c.env, [result.message])
    if (message && result.changed)
      c.executionCtx.waitUntil(
        publishChatEvent(c.env, {
          type: "message_changed",
          roomId: roomId.output,
          message,
        })
      )
    return c.json({ message })
  })
}

chatApp.patch("/rooms/:roomId/preferences", async (c) => {
  const input = v.safeParse(
    chatPreferencesInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) return apiError(c, errors.invalidChatPreferences)
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId"),
    c.get("member").id
  )
  if (!room) return apiError(c, errors.chatRoomNotFound)
  const memberId = c.get("member").id
  await c.env.shift_app
    .prepare(
      `INSERT INTO chat_room_preferences (room_id,member_id,muted,last_read) VALUES (?,?,?,?) ON CONFLICT(room_id,member_id) DO UPDATE SET muted=CASE WHEN ? THEN excluded.muted ELSE chat_room_preferences.muted END,last_read=MAX(chat_room_preferences.last_read,excluded.last_read)`
    )
    .bind(
      room.id,
      memberId,
      input.output.muted === undefined
        ? room.muted
        : input.output.muted
          ? 1
          : 0,
      Math.min(room.lastSequence, input.output.lastRead ?? room.lastRead),
      input.output.muted === undefined ? 0 : 1
    )
    .run()
  const current = await findAccessibleRoom(c.env, room.id, memberId)
  if (current)
    c.executionCtx.waitUntil(
      c.env.CHAT_DIRECTORY.getByName("rooms").publish([memberId], {
        type: "preferences_changed",
        roomId: room.id,
        lastRead: current.lastRead,
        muted: current.muted === 1,
      })
    )
  return c.body(null, 204)
})
chatApp.get("/rooms/:roomId/settings", async (c) => {
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId"),
    c.get("member").id
  )
  if (!room?.canManage) return apiError(c, errors.chatManagementRequired)
  const targets = await c.env.shift_app
    .prepare(
      "SELECT target_type AS targetType,target_id AS targetId,can_read AS canRead,can_post AS canPost,can_manage AS canManage FROM chat_room_targets WHERE room_id=?"
    )
    .bind(room.id)
    .all<{
      targetType: string
      targetId: string
      canRead: number
      canPost: number
      canManage: number
    }>()
  return c.json({
    name: room.name,
    allowExit: room.allowExit === 1,
    targets: targets.results.map((target) => ({
      ...target,
      canRead: target.canRead === 1,
      canPost: target.canPost === 1,
      canManage: target.canManage === 1,
    })),
  })
})
chatApp.put("/rooms/:roomId/settings", async (c) => {
  const input = v.safeParse(roomSettingsInputSchema, await readJson(c.req.raw))
  if (!input.success) return apiError(c, errors.invalidChatSettings)
  const actor = c.get("member"),
    room = await findAccessibleRoom(c.env, c.req.param("roomId"), actor.id)
  if (!room?.canManage) return apiError(c, errors.chatManagementRequired)
  const valid = await Promise.all(
    input.output.targets.map((target) => targetExists(c.env, room.year, target))
  )
  if (valid.some((value) => !value))
    return apiError(c, errors.invalidActivityTarget)
  const managers = input.output.targets.filter((target) => target.canManage)
  const subjects = await c.env.shift_app
    .prepare(
      `${chatPermissions} SELECT s.target_type AS targetType,s.target_id AS targetId FROM chat_subjects s JOIN year_memberships ym ON ym.year=s.year AND ym.member_id=s.member_id AND ym.status='active' WHERE s.year=? AND NOT EXISTS(SELECT 1 FROM chat_room_exits x WHERE x.room_id=? AND x.member_id=s.member_id)`
    )
    .bind(room.year, room.id)
    .all<{ targetType: string; targetId: string }>()
  if (
    !managers.some((target) =>
      subjects.results.some(
        (subject) =>
          subject.targetType === target.targetType &&
          subject.targetId === target.targetId
      )
    )
  )
    return apiError(c, errors.chatManagerRequired)
  if (
    new Set(
      input.output.targets.map(
        (target) => `${target.targetType}:${target.targetId}`
      )
    ).size !== input.output.targets.length
  )
    return apiError(c, errors.duplicateTarget)
  const previous = await roomRecipients(c.env, room.id)
  try {
    await saveRoomSettings(c.env.shift_app, room.id, actor.id, input.output)
  } catch (error) {
    if (error instanceof Error && error.message.includes("chat_rooms.name"))
      return apiError(c, errors.chatSettingsReload)
    throw error
  }
  c.executionCtx.waitUntil(
    publishRoomChange(
      c.env,
      room.id,
      previous.map((member) => member.id)
    )
  )
  return c.body(null, 204)
})
