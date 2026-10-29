import { Hono } from "hono"
import * as v from "valibot"
import { assignmentOverwriteInputSchema } from "@workspace/shared/shifts"
import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, readJson } from "../../../lib/http"
import { canEditActivity } from "../services/activity-access"
import { prepareActivitySave } from "../services/prepare-activity-save"
import { readActivityEditor } from "../services/activity-editor"
import {
  reviewAssignmentOverwrite,
  overwriteStatements,
} from "../../shifts/services/assignment-overwrites"
import { saveShiftPlan } from "../../shifts/services/save-shift-plan"
import { announce } from "../../../routes/announce"
import { createMiddleware } from "hono/factory"

export const assignmentOverwritesApp = new Hono<ApiEnv>()
const authorize = createMiddleware<ApiEnv>(async (c, next) => {
  const id = c.req.param("activityId") ?? "",
    activity = await c.env.shift_app
      .prepare("SELECT year FROM activities WHERE id=?")
      .bind(id)
      .first<{ year: number }>()
  if (!activity) return apiError(c, errors.activityNotFound)
  if (!(await canEditActivity(c.env, c.get("member"), id, activity.year)))
    return apiError(c, errors.shiftResponsibilityRequired)
  return next()
})
assignmentOverwritesApp.post(
  "/:activityId/overlap-review",
  authorize,
  async (c) => {
    const id = c.req.param("activityId"),
      prepared = await prepareActivitySave(
        c.env.shift_app,
        id,
        await readJson(c.req.raw),
        true
      )
    if ("failure" in prepared)
      return apiError(c, prepared.failure, prepared.message)
    const review = await reviewAssignmentOverwrite(
      c.env,
      c.get("member"),
      id,
      prepared.current.activity.year,
      prepared.input,
      prepared.current.members
    )
    return c.json({ token: review.token, changes: review.changes })
  }
)
assignmentOverwritesApp.put(
  "/:activityId/overwrite",
  authorize,
  announce({ type: "shifts_changed" }),
  async (c) => {
    const id = c.req.param("activityId"),
      parsed = v.safeParse(
        assignmentOverwriteInputSchema,
        await readJson(c.req.raw)
      )
    if (!parsed.success) return apiError(c, errors.invalidShift)
    const prepared = await prepareActivitySave(
      c.env.shift_app,
      id,
      parsed.output.plan,
      true
    )
    if ("failure" in prepared)
      return apiError(c, prepared.failure, prepared.message)
    const review = await reviewAssignmentOverwrite(
      c.env,
      c.get("member"),
      id,
      prepared.current.activity.year,
      prepared.input,
      prepared.current.members
    )
    if (review.token !== parsed.output.token)
      return apiError(c, errors.assignmentOverwriteChanged)
    if (review.changes.some((change) => change.blockedReason !== null))
      return apiError(c, errors.assignmentOverwriteBlocked)
    try {
      await saveShiftPlan(
        c.env.shift_app,
        id,
        c.get("member").id,
        prepared.input,
        prepared.current,
        overwriteStatements(c.env.shift_app, c.get("member").id, id, review)
      )
    } catch (error) {
      if (
        error instanceof Error &&
        /SHIFT_OVERLAP|activity_history.before|RESPONSIBLE_REQUIRED|YEAR_MEMBERSHIP_REQUIRED|FOREIGN KEY/.test(
          error.message
        )
      )
        return apiError(c, errors.assignmentOverwriteChanged)
      throw error
    }
    return c.json(await readActivityEditor(c.env.shift_app, id))
  }
)
