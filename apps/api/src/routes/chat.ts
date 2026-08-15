import { Hono } from "hono"
import { z } from "zod"

import {
  createChatRoomInputSchema,
  sendChatMessageInputSchema,
} from "@workspace/shared/communications"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  hasActiveYearMembership,
  readJson,
  toIso,
} from "../http"

const idSchema = z.string().uuid()
const messagesQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

type RoomRow = {
  id: string
  year: number
  name: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

function roomJson(room: RoomRow) {
  return {
    ...room,
    createdAt: toIso(room.createdAt),
    updatedAt: toIso(room.updatedAt),
  }
}

async function findAccessibleRoom(
  env: CloudflareBindings,
  roomId: string,
  memberId: string
): Promise<RoomRow | null> {
  return env.shift_app
    .prepare(
      `SELECT room.id, room.year, room.name, room.created_by AS createdBy,
              room.created_at AS createdAt, room.updated_at AS updatedAt
       FROM chat_rooms room
       WHERE room.id = ? AND room.status = 'active'
         AND EXISTS (
           SELECT 1 FROM year_memberships year_membership
           WHERE year_membership.year = room.year
             AND year_membership.member_id = ?
             AND year_membership.status = 'active'
         )
         AND (
           room.created_by = ?
           OR EXISTS (
             SELECT 1 FROM chat_room_targets target
             WHERE target.room_id = room.id
               AND (
                 (target.target_type = 'member' AND target.target_id = ?)
                 OR (target.target_type = 'role' AND EXISTS (
                   SELECT 1 FROM member_year_roles membership
                   WHERE membership.member_id = ? AND membership.role_id = target.target_id
                 ))
                 OR (target.target_type = 'activity' AND EXISTS (
                   SELECT 1 FROM shift_assignments assignment
                   WHERE assignment.member_id = ?
                     AND assignment.activity_id = target.target_id
                     AND assignment.status = 'active'
                 ))
               )
           )
         )`
    )
    .bind(roomId, memberId, memberId, memberId, memberId, memberId)
    .first<RoomRow>()
}

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
  const member = c.get("member")
  const rooms = await c.env.shift_app
    .prepare(
      `SELECT room.id, room.year, room.name, room.created_by AS createdBy,
              room.created_at AS createdAt, room.updated_at AS updatedAt
       FROM chat_rooms room
       WHERE room.status = 'active'
         AND EXISTS (
           SELECT 1 FROM year_memberships year_membership
           WHERE year_membership.year = room.year
             AND year_membership.member_id = ?
             AND year_membership.status = 'active'
         )
         AND (
           room.created_by = ?
           OR EXISTS (
             SELECT 1 FROM chat_room_targets target
             WHERE target.room_id = room.id
               AND (
                 (target.target_type = 'member' AND target.target_id = ?)
                 OR (target.target_type = 'role' AND EXISTS (
                   SELECT 1 FROM member_year_roles membership
                   WHERE membership.member_id = ? AND membership.role_id = target.target_id
                 ))
                 OR (target.target_type = 'activity' AND EXISTS (
                   SELECT 1 FROM shift_assignments assignment
                   WHERE assignment.member_id = ?
                     AND assignment.activity_id = target.target_id
                     AND assignment.status = 'active'
                 ))
               )
           )
         )
       ORDER BY room.updated_at DESC
       LIMIT 200`
    )
    .bind(member.id, member.id, member.id, member.id, member.id)
    .all<RoomRow>()
  return c.json({ rooms: rooms.results.map(roomJson) })
})

chatApp.post("/rooms", async (c) => {
  const input = createChatRoomInputSchema.safeParse(await readJson(c.req.raw))
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_CHAT_ROOM",
      input.error.issues[0]?.message ?? "Invalid chat room"
    )
  }
  const actor = c.get("member")
  if (!(await hasActiveYearMembership(c.env, actor.id, input.data.year))) {
    return apiError(
      c,
      403,
      "YEAR_MEMBERSHIP_REQUIRED",
      "Active year membership is required"
    )
  }
  const targets = [
    ...new Map(
      input.data.targets.map((target) => [
        `${target.targetType}:${target.targetId}`,
        target,
      ])
    ).values(),
  ]
  if (
    targets.some((target) => target.targetType !== "member") &&
    !(await canManageShifts(c.env, actor, input.data.year))
  ) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required for role or activity rooms"
    )
  }
  const validTargets = await Promise.all(
    targets.map((target) => targetExists(c.env, input.data.year, target))
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
         FROM operating_years WHERE year = ? AND status <> 'archived'`
      )
      .bind(roomId, input.data.name, actor.id, now, now, input.data.year),
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
  if (results[0]?.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "YEAR_NOT_EDITABLE",
      "Operating year is archived or missing"
    )
  }
  return c.json(
    {
      room: roomJson({
        id: roomId,
        year: input.data.year,
        name: input.data.name,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
      }),
    },
    201
  )
})

chatApp.get("/rooms/:roomId/messages", async (c) => {
  const id = idSchema.safeParse(c.req.param("roomId"))
  const query = messagesQuerySchema.safeParse(c.req.query())
  if (!id.success || !query.success) {
    return apiError(c, 422, "INVALID_CHAT_QUERY", "Invalid chat request")
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.data, member.id)
  if (!room) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  return c.json(
    await stub.getMessages(query.data.before ?? null, query.data.limit)
  )
})

chatApp.post("/rooms/:roomId/messages", async (c) => {
  const id = idSchema.safeParse(c.req.param("roomId"))
  if (!id.success) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  const input = sendChatMessageInputSchema.safeParse(await readJson(c.req.raw))
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_CHAT_MESSAGE",
      input.error.issues[0]?.message ?? "Invalid chat message"
    )
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.data, member.id)
  if (!room) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  const now = Date.now()
  const stub = c.env.CHAT_ROOMS.getByName(room.id)
  const message = await stub.sendMessage({
    id: input.data.id,
    memberId: member.id,
    memberDisplayName: member.displayName,
    content: input.data.content,
    createdAt: now,
  })
  await c.env.shift_app
    .prepare("UPDATE chat_rooms SET updated_at = ? WHERE id = ?")
    .bind(now, room.id)
    .run()
  return c.json({ message }, 201)
})

chatApp.get("/rooms/:roomId/ws", async (c) => {
  if (c.req.header("Origin") !== c.env.BETTER_AUTH_URL) {
    return apiError(c, 403, "FORBIDDEN_ORIGIN", "Request origin is not allowed")
  }
  const id = idSchema.safeParse(c.req.param("roomId"))
  if (!id.success) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, id.data, member.id)
  if (!room) {
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "Chat room not found")
  }
  const headers = new Headers(c.req.raw.headers)
  headers.delete("Cookie")
  headers.set("X-Chat-Member-Id", member.id)
  return c.env.CHAT_ROOMS.getByName(room.id).fetch(
    new Request(c.req.raw, { headers })
  )
})
