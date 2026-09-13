import { cleanDeletedRooms } from "../services/chat-cleanup"
import { activityActionsApp } from "./activity-actions"
import { activityAttendanceApp } from "./activity-attendance"
import { Hono } from "hono"
import * as v from "valibot"
import { activityEditorInputSchema } from "@workspace/shared/shifts"
import { apiError, errors, shiftPlanErrors } from "../lib/errors"
import { type ApiEnv, readJson } from "../lib/http"
import { canEditActivity } from "../services/activity-access"
import { readActivityEditor } from "../services/activity-editor"
import { saveShiftPlan } from "../services/save-shift-plan"
import { validateShiftPlan } from "../domain/shift-plan"

export const activitiesApp = new Hono<ApiEnv>()
activitiesApp.use("/:activityId", async (c, next) => {
  const activity = await c.env.shift_app
    .prepare("SELECT year FROM activities WHERE id=?")
    .bind(c.req.param("activityId"))
    .first<{ year: number }>()
  if (!activity) return apiError(c, errors.activityNotFound)
  if (
    !(await canEditActivity(
      c.env,
      c.get("member"),
      c.req.param("activityId"),
      activity.year
    ))
  )
    return apiError(c, errors.shiftResponsibilityRequired)
  return next()
})
activitiesApp.get("/:activityId", async (c) => {
  const result = await readActivityEditor(
    c.env.shift_app,
    c.req.param("activityId")
  )
  if (!result) return apiError(c, errors.activityNotFound)
  return c.json(result)
})
activitiesApp.put("/:activityId", async (c) => {
  const parsed = v.safeParse(
    activityEditorInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success)
    return apiError(c, errors.invalidShift, parsed.issues[0]?.message)
  const id = c.req.param("activityId"),
    input = parsed.output
  const current = await readActivityEditor(c.env.shift_app, id)
  if (!current) return apiError(c, errors.activityNotFound)
  if (current.activity.version !== input.version)
    return apiError(c, errors.shiftStale)
  const checked = validateShiftPlan(
    input,
    current.members.map((member) => member.id),
    current.otherAssignments,
    current.availability
  )
  if (checked.error) return apiError(c, shiftPlanErrors[checked.error])
  if (
    input.candidateRoleIds.some(
      (roleId) => !current.roles.some((role) => role.id === roleId)
    )
  )
    return apiError(c, errors.invalidYearRole)
  if (
    input.responsibles.some((target) =>
      target.targetType === "member"
        ? !current.members.some((member) => member.id === target.targetId)
        : !current.roles.some((role) => role.id === target.targetId)
    )
  )
    return apiError(c, errors.invalidResponsible)
  const hasResponsible = current.members.some((member) =>
    input.responsibles.some((target) =>
      target.targetType === "member"
        ? target.targetId === member.id
        : member.roles.some((role) => role.id === target.targetId)
    )
  )
  if (input.active && !hasResponsible)
    return apiError(c, errors.responsibleRequired)
  const slotIds = await c.env.shift_app
    .prepare("SELECT id,activity_id AS activityId FROM shift_slots")
    .all<{ id: string; activityId: string }>()
  if (
    input.slots.some((slot) =>
      slotIds.results.some(
        (existing) => existing.id === slot.id && existing.activityId !== id
      )
    )
  )
    return apiError(c, errors.slotFromOtherShift)
  try {
    await saveShiftPlan(c.env.shift_app, id, c.get("member").id, input, current)
  } catch (error) {
    if (
      error instanceof Error &&
      /SHIFT_OVERLAP|activity_history.before|RESPONSIBLE_REQUIRED|YEAR_MEMBERSHIP_REQUIRED/.test(
        error.message
      )
    )
      return apiError(c, errors.shiftConflict)
    throw error
  }
  return c.json(await readActivityEditor(c.env.shift_app, id))
})

activitiesApp.route("/", activityAttendanceApp)

activitiesApp.route("/", activityActionsApp)
activitiesApp.delete("/:activityId", async (c) => {
  const id = c.req.param("activityId"),
    actor = c.get("member")
  const before = await readActivityEditor(c.env.shift_app, id)
  if (!before) return apiError(c, errors.activityNotFound)
  await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(
        'INSERT INTO activity_history (id,activity_id,actor_id,"before","after",created_at) VALUES (?,?,?,?,?,?)'
      )
      .bind(
        crypto.randomUUID(),
        id,
        actor.id,
        JSON.stringify(before),
        JSON.stringify({ deleted: true }),
        Date.now()
      ),
    c.env.shift_app
      .prepare(
        "DELETE FROM chat_room_targets WHERE target_type IN ('activity','responsible') AND target_id=?"
      )
      .bind(id),
    c.env.shift_app
      .prepare(
        "DELETE FROM shift_assignments WHERE slot_id IN (SELECT id FROM shift_slots WHERE activity_id=?)"
      )
      .bind(id),
    c.env.shift_app
      .prepare(
        "INSERT OR IGNORE INTO chat_room_deletions(room_id,created_at) SELECT id,? FROM chat_rooms WHERE id IN (SELECT room_id FROM activity_chat_rooms WHERE activity_id=?)"
      )
      .bind(Date.now(), id),
    c.env.shift_app
      .prepare(
        "DELETE FROM chat_rooms WHERE id IN (SELECT room_id FROM activity_chat_rooms WHERE activity_id=?)"
      )
      .bind(id),
    c.env.shift_app.prepare("DELETE FROM activities WHERE id=?").bind(id),
  ])
  c.executionCtx.waitUntil(cleanDeletedRooms(c.env))
  return c.body(null, 204)
})
