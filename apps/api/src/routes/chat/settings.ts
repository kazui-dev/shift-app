import { Hono } from "hono"
import * as v from "valibot"

import {
  chatPreferencesInputSchema,
  roomSettingsInputSchema,
} from "@workspace/shared/communications"

import { apiError, errors } from "../../lib/errors"
import { readJson } from "../../lib/http"
import { findAccessibleRoom } from "../../services/chat-access"
import { publishRoomChange } from "../../services/chat-directory"
import {
  chatPermissions,
  roomRecipients,
} from "../../services/chat-permissions"
import { saveRoomSettings } from "../../services/chat-settings"
import { targetExists } from "../../services/chat-targets"
import type { RoomEnv } from "./room"

export const settingsApp = new Hono<RoomEnv>()

settingsApp.patch("/preferences", async (c) => {
  const input = v.safeParse(
    chatPreferencesInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) return apiError(c, errors.invalidChatPreferences)
  const room = c.get("room"),
    memberId = c.get("member").id
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

settingsApp.get("/settings", async (c) => {
  const room = c.get("room")
  if (!room.canManage) return apiError(c, errors.chatManagementRequired)
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

settingsApp.put("/settings", async (c) => {
  const input = v.safeParse(roomSettingsInputSchema, await readJson(c.req.raw))
  if (!input.success) return apiError(c, errors.invalidChatSettings)
  const room = c.get("room"),
    actor = c.get("member")
  if (!room.canManage) return apiError(c, errors.chatManagementRequired)
  const valid = await Promise.all(
    input.output.targets.map((target) => targetExists(c.env, room.year, target))
  )
  if (valid.some((target) => !target))
    return apiError(c, errors.invalidActivityTarget)
  const subjects = await c.env.shift_app
    .prepare(
      `${chatPermissions} SELECT s.target_type AS targetType,s.target_id AS targetId FROM chat_subjects s JOIN year_memberships ym ON ym.year=s.year AND ym.member_id=s.member_id AND ym.status='active' WHERE s.year=? AND NOT EXISTS(SELECT 1 FROM chat_room_exits x WHERE x.room_id=? AND x.member_id=s.member_id)`
    )
    .bind(room.year, room.id)
    .all<{ targetType: string; targetId: string }>()
  const reachable = input.output.targets.some(
    (target) =>
      target.canManage &&
      subjects.results.some(
        (subject) =>
          subject.targetType === target.targetType &&
          subject.targetId === target.targetId
      )
  )
  if (!reachable) return apiError(c, errors.chatManagerRequired)
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
