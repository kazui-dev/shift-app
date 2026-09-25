import { Hono } from "hono"
import * as v from "valibot"

import { createChatRoomInputSchema } from "@workspace/shared/communications"

import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, parseYear, readJson } from "../../../lib/http"
import { hasActiveYearMembership } from "../../../auth/authorization/membership"
import {
  findAccessibleRoom,
  roomJson,
  roomSelection,
  type RoomRow,
} from "../services/chat-access"
import { memberRoom, roomStatements } from "../services/chat-creation"
import { deleteRoom } from "../services/chat-deletion"
import {
  publishRoomChange,
  roomChangeRecipients,
} from "../services/chat-directory"
import { roomRecipients } from "../services/chat-permissions"
import { targetExists } from "../services/chat-targets"
import type { RoomEnv } from "./room"

export const roomsApp = new Hono<ApiEnv>()

roomsApp.get("/rooms", async (c) => {
  const year = parseYear(c.req.query("year") ?? "")
  if (year === null) return apiError(c, errors.yearRequired)
  const rooms = await c.env.shift_app
    .prepare(
      `${roomSelection} AND r.year=? ORDER BY r.updated_at DESC,r.id ASC LIMIT 200`
    )
    .bind(c.get("member").id, year)
    .all<RoomRow>()
  return c.json({ rooms: rooms.results.map(roomJson) })
})

roomsApp.post("/rooms", async (c) => {
  const input = v.safeParse(
    createChatRoomInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success)
    return apiError(c, errors.invalidChatRoom, input.issues[0]?.message)
  const actor = c.get("member")
  if (!(await hasActiveYearMembership(c.env, actor.id, input.output.year)))
    return apiError(c, errors.yearMembershipRequired)
  const room = memberRoom(input.output, actor.id)
  const valid = await Promise.all(
    room.targets.map((target) => targetExists(c.env, room.year, target))
  )
  if (valid.some((target) => !target))
    return apiError(c, errors.invalidChatTarget)
  await c.env.shift_app.batch(roomStatements(c.env.shift_app, room, Date.now()))
  // The batch only writes while the year exists, so a missing room means it went.
  const created = await findAccessibleRoom(c.env, room.id, actor.id)
  if (!created) return apiError(c, errors.chatRoomCreateFailed)
  c.executionCtx.waitUntil(publishRoomChange(c.env, room.id))
  return c.json({ room: roomJson(created) }, 201)
})

export const roomApp = new Hono<RoomEnv>()

roomApp.get("/", (c) => c.json({ room: roomJson(c.get("room")) }))

roomApp.delete("/", async (c) => {
  const room = c.get("room")
  if (!room.canManage) return apiError(c, errors.chatManagementRequired)
  if (room.activityId !== null) return apiError(c, errors.shiftRoomKept)
  const previous = await roomChangeRecipients(c.env, room.id)
  const deleted = await deleteRoom(c.env.shift_app, room.id, c.get("member").id)
  if (!deleted) return apiError(c, errors.chatSettingsChanged)
  c.executionCtx.waitUntil(publishRoomChange(c.env, room.id, previous))
  return c.body(null, 204)
})

roomApp.get("/members", async (c) => {
  const roomId = c.get("room").id
  const [members, bots] = await Promise.all([
    roomRecipients(c.env, roomId),
    c.env.shift_app
      .prepare(
        `SELECT bot.id, bot.display_name AS displayName FROM bots bot
       JOIN chat_room_bots member ON member.bot_id = bot.id AND member.room_id = ?
       ORDER BY bot.display_name`
      )
      .bind(roomId)
      .all<{ id: string; displayName: string }>(),
  ])
  return c.json({
    members: members.map(({ muted: _muted, ...member }) => ({
      ...member,
      canManage: member.canManage === 1,
    })),
    bots: bots.results,
  })
})
