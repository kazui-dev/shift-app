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
  canManageShifts,
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

async function targetExists(
  env: CloudflareBindings,
  year: number,
  target: { targetType: "member" | "role" | "activity"; targetId: string }
): Promise<boolean> {
  const queries = {
    member: `SELECT 1 AS found FROM year_memberships
             WHERE member_id = ? AND year = ? AND status = 'active'`,
    role: "SELECT 1 AS found FROM year_roles WHERE id = ? AND year = ?",
    activity: "SELECT 1 AS found FROM activities WHERE id = ? AND year = ?",
  } as const
  const statement = env.shift_app.prepare(queries[target.targetType])
  const row = await statement
    .bind(target.targetId, year)
    .first<{ found: number }>()
  return row?.found === 1
}

export const chatApp = new Hono<ApiEnv>()

chatApp.get("/rooms", async (c) => {
  const year = parseYear(c.req.query("year") ?? "")
  if (year === null) return apiError(c, 422, "INVALID_YEAR", "Year is required")
  const member = c.get("member")
  const rooms = await c.env.shift_app
    .prepare(
      `${roomSelection} AND r.year=? AND r.status=? ORDER BY CASE r.kind WHEN 'global' THEN 0 ELSE 1 END,r.updated_at DESC LIMIT 200`
    )
    .bind(
      member.id,
      year,
      c.req.query("closed") === "true" ? "archived" : "active"
    )
    .all<RoomRow>()

  return c.json({ rooms: rooms.results.map(roomJson) })
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
  if (
    targets.some((target) => target.targetType !== "member") &&
    !(await canManageShifts(c.env, actor, input.output.year))
  ) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required for role or activity rooms"
    )
  }
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
          (id, year, name, status, created_by, created_at, updated_at)
         SELECT ?, year, ?, 'active', ?, ?, ?
         FROM operating_years WHERE year = ? RETURNING id`
      )
      .bind(roomId, input.output.name, actor.id, now, now, input.output.year),
    ...targets.map((target) =>
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
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  return c.json(
    await stub.getMessages(
      query.output.before ?? null,
      query.output.limit,
      room.exitedAt
    )
  )
})

chatApp.post("/rooms/:roomId/messages", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("roomId"))
  if (!id.success) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
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
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  if (!room.canPost)
    return apiError(c, 403, "CHAT_READ_ONLY", "このルームには投稿できません。")
  const now = Date.now()
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const message = await stub.sendMessage({
    roomId: room.id,
    id: input.output.id,
    memberId: member.id,
    memberDisplayName: member.displayName,
    content: input.output.content,
    createdAt: now,
  })
  const updated = await c.env.shift_app
    .prepare(
      "UPDATE chat_rooms SET updated_at = ?, last_sequence = MAX(last_sequence,?) WHERE id = ? AND last_sequence < ?"
    )
    .bind(now, message.sequence, room.id, message.sequence)
    .run()
  if (updated.meta.changes > 0)
    c.executionCtx.waitUntil(
      notifyRoomMessage(
        c.env,
        room.id,
        member.id,
        room.name,
        input.output.content
      )
    )
  return c.json({ message }, 201)
})

chatApp.get("/rooms/:roomId/ws", async (c) => {
  if (c.req.header("Origin") !== c.env.BETTER_AUTH_URL) {
    return apiError(c, 403, "FORBIDDEN_ORIGIN", "Request origin is not allowed")
  }
  const id = v.safeParse(idSchema, c.req.param("roomId"))
  if (!id.success) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.output, member.id)
  if (!room) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  if (room.exitedAt !== null)
    return apiError(c, 403, "CHAT_READ_ONLY", "Room access has ended")
  const headers = new Headers(c.req.raw.headers)
  headers.delete("Cookie")
  headers.set("X-Chat-Member-Id", member.id)
  headers.set("X-Chat-Room-Id", room.id)
  return c.env.CHAT_ROOMS.getByName(room.id).fetch(
    new Request(c.req.raw, { headers })
  )
})

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
  if (!room) return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Room not found")
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
    kind: room.kind,
    closed: room.status === "archived",
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
  if (room.kind !== "custom" && input.output.closed)
    return apiError(
      c,
      409,
      "AUTOMATIC_ROOM",
      "このルームはシフト・年度から管理します。"
    )
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
  const now = Date.now()
  await c.env.shift_app.batch([
    c.env.shift_app
      .prepare("UPDATE chat_rooms SET name=?,status=?,updated_at=? WHERE id=?")
      .bind(
        room.kind === "custom" ? input.output.name : room.name,
        input.output.closed ? "archived" : "active",
        now,
        room.id
      ),
    c.env.shift_app
      .prepare("DELETE FROM chat_room_targets WHERE room_id=?")
      .bind(room.id),
    ...input.output.targets.map((target) =>
      c.env.shift_app
        .prepare(
          "INSERT INTO chat_room_targets (room_id,target_type,target_id,can_read,can_post,can_manage,created_at) VALUES (?,?,?,?,?,?,?)"
        )
        .bind(
          room.id,
          target.targetType,
          target.targetId,
          target.canRead ? 1 : 0,
          target.canPost ? 1 : 0,
          target.canManage ? 1 : 0,
          now
        )
    ),
  ])
  return c.body(null, 204)
})
