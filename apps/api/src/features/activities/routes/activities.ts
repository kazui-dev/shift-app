import { cleanDeletedRooms } from "../../chat/services/chat-cleanup"
import { activityActionsApp } from "./activity-actions"
import { activityAttendanceApp } from "./activity-attendance"
import { Hono } from "hono"
import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, readJson } from "../../../lib/http"
import { canEditActivity } from "../services/activity-access"
import { readActivityEditor } from "../services/activity-editor"
import { saveShiftPlan } from "../../shifts/services/save-shift-plan"
import { prepareActivitySave } from "../services/prepare-activity-save"
import { assignmentOverwritesApp } from "./assignment-overwrites"
import { announce } from "../../../routes/announce"
import { activityPlansApp } from "./activity-plans"

export { inputSlotOwners } from "../services/slot-owners"

export const activitiesApp = new Hono<ApiEnv>()
activitiesApp.route("/", activityPlansApp)
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
activitiesApp.put(
  "/:activityId",
  announce({ type: "shifts_changed" }),
  async (c) => {
    const id = c.req.param("activityId")
    const prepared = await prepareActivitySave(
      c.env.shift_app,
      id,
      await readJson(c.req.raw)
    )
    if ("failure" in prepared)
      return apiError(c, prepared.failure, prepared.message)
    const { input, current } = prepared
    try {
      await saveShiftPlan(
        c.env.shift_app,
        id,
        c.get("member").id,
        input,
        current
      )
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
  }
)

activitiesApp.route("/", assignmentOverwritesApp)

activitiesApp.route("/", activityAttendanceApp)

activitiesApp.route("/", activityActionsApp)
activitiesApp.delete(
  "/:activityId",
  announce({ type: "shifts_changed" }),
  async (c) => {
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
  }
)
