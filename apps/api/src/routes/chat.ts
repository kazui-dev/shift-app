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

import {
  apiError,
  type ApiEnv,
  hasActiveYearMembership,
  readJson,
  parseYear,
} from "../lib/http"

const idSchema = v.pipe(v.string(), v.uuid())
const messagesQuerySchema = v.object({
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

chatApp.get("/rooms", async (c) => {
  const year = parseYear(c.req.query("year") ?? "")
  if (year === null) return apiError(c, 422, "INVALID_YEAR", "Year is required")
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
    : apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "チャットが見つかりません。")
})

chatApp.delete("/rooms/:roomId", async (c) => {
  const actor = c.get("member")
  const room = await findAccessibleRoom(c.env, c.req.param("roomId"), actor.id)
  if (!room)
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "チャットが見つかりません。")
  if (!room.canManage)
    return apiError(c, 403, "FORBIDDEN", "チャットの管理権限が必要です。")
  const previous = await roomChangeRecipients(c.env, room.id)
  const deleted = await deleteRoom(c.env.shift_app, room.id, actor.id)
  if (!deleted)
    return apiError(c, 409, "CHAT_SETTINGS_CHANGED", "権限が変更されました。")
  c.executionCtx.waitUntil(publishRoomChange(c.env, room.id, previous))
  return c.body(null, 204)
})

chatApp.get("/rooms/:roomId/members", async (c) => {
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId"),
    c.get("member").id
  )
  if (!room || room.exitedAt !== null)
    return apiError(c, 404, "NOT_FOUND", "メンバーを表示できません。")
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
    return apiError(c, 403, "FORBIDDEN_ORIGIN", "Request origin is not allowed")
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
    return apiError(
      c,
      422,
      "INVALID_CHAT_ROOM",
      input.issues[0]?.message ?? "Invalid chat room"
    )
  }
  const actor = c.get("member")
  if (!(await hasActiveYearMembership(c.env, actor.id, input.output.year))) {
    return apiError(
      c,
      403,
      "YEAR_MEMBERSHIP_REQUIRED",
      "Active year membership is required"
    )
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
    return apiError(c, 422, "INVALID_CHAT_TARGET", "A chat target is invalid")
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
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const created = await findAccessibleRoom(c.env, roomId, actor.id)
  if (!created)
    return apiError(c, 500, "ROOM_CREATE_FAILED", "Room could not be read")
  c.executionCtx.waitUntil(publishRoomChange(c.env, roomId))
  return c.json({ room: roomJson(created) }, 201)
})

chatApp.get("/rooms/:roomId/messages", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("roomId"))
  const query = v.safeParse(messagesQuerySchema, c.req.query())
  if (!id.success || !query.success) {
    return apiError(c, 422, "INVALID_CHAT_QUERY", "Invalid chat request")
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.output, member.id)
  if (!room) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "チャットが見つかりません。")
  }
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const history = await stub.getMessages(
    query.output.before ?? null,
    query.output.limit,
    room.exitedAt
  )
  return c.json({
    ...history,
    messages: await withMemberImages(c.env, history.messages),
  })
})

chatApp.post("/rooms/:roomId/messages", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("roomId"))
  if (!id.success) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "チャットが見つかりません。")
  }
  const input = v.safeParse(
    sendChatMessageInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_CHAT_MESSAGE",
      input.issues[0]?.message ?? "Invalid chat message"
    )
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.output, member.id)
  if (!room) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "チャットが見つかりません。")
  }
  if (!room.canPost)
    return apiError(
      c,
      403,
      "CHAT_READ_ONLY",
      "このチャットには投稿できません。"
    )
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
    return apiError(c, 403, "CHAT_READ_ONLY", "投稿権限が変更されました。")
  if (!message)
    return apiError(
      c,
      422,
      "INVALID_CHAT_ATTACHMENTS",
      "画像または返信先を確認して、もう一度送信してください。"
    )
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
      return apiError(
        c,
        404,
        "MESSAGE_NOT_FOUND",
        "メッセージが見つかりません。"
      )
    let content: string | undefined
    if (method === "patch") {
      const input = v.safeParse(
        editChatMessageInputSchema,
        await readJson(c.req.raw)
      )
      if (!input.success)
        return apiError(c, 422, "INVALID_MESSAGE", "本文を確認してください。")
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
        return apiError(
          c,
          404,
          "MESSAGE_NOT_FOUND",
          "メッセージが見つかりません。"
        )
      if (result.error === "forbidden")
        return apiError(
          c,
          403,
          "MESSAGE_FORBIDDEN",
          "このメッセージは変更できません。"
        )
      return apiError(c, 422, "EMPTY_MESSAGE", "本文または画像が必要です。")
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
  if (!input.success)
    return apiError(c, 422, "INVALID_PREFERENCES", "Invalid room preferences")
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId"),
    c.get("member").id
  )
  if (!room)
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "チャットが見つかりません。")
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
  if (!room?.canManage)
    return apiError(c, 403, "FORBIDDEN", "Room management is required")
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
  if (!input.success)
    return apiError(c, 422, "INVALID_ROOM_SETTINGS", "Invalid room settings")
  const actor = c.get("member"),
    room = await findAccessibleRoom(c.env, c.req.param("roomId"), actor.id)
  if (!room?.canManage)
    return apiError(c, 403, "FORBIDDEN", "Room management is required")
  const valid = await Promise.all(
    input.output.targets.map((target) => targetExists(c.env, room.year, target))
  )
  if (valid.some((value) => !value))
    return apiError(
      c,
      422,
      "INVALID_TARGET",
      "Targets must belong to this year"
    )
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
    return apiError(
      c,
      409,
      "LAST_CHAT_MANAGER",
      "設定変更できるメンバーを残してください。"
    )
  if (
    new Set(
      input.output.targets.map(
        (target) => `${target.targetType}:${target.targetId}`
      )
    ).size !== input.output.targets.length
  )
    return apiError(
      c,
      422,
      "DUPLICATE_TARGET",
      "同じ対象は一度だけ指定してください。"
    )
  const previous = await roomRecipients(c.env, room.id)
  try {
    await saveRoomSettings(c.env.shift_app, room.id, actor.id, input.output)
  } catch (error) {
    if (error instanceof Error && error.message.includes("chat_rooms.name"))
      return apiError(
        c,
        409,
        "CHAT_SETTINGS_CHANGED",
        "権限が変更されました。設定を読み直してください。"
      )
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
