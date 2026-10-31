import { Hono } from "hono"
import * as v from "valibot"
import { activityPlansInputSchema } from "@workspace/shared/shifts"
import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, readJson } from "../../../lib/http"
import { announce } from "../../../routes/announce"
import { canEditActivity } from "../services/activity-access"
import { prepareActivitySave } from "../services/prepare-activity-save"
import { readActivityEditor } from "../services/activity-editor"
import { shiftPlanStatements } from "../../shifts/services/save-shift-plan"
import { activityPlanningAssignments } from "../../directory/services/directory-work"

export const activityPlansApp = new Hono<ApiEnv>()
activityPlansApp.put(
  "/plans",
  announce({ type: "shifts_changed" }),
  async (c) => {
    const parsed = v.safeParse(
      activityPlansInputSchema,
      await readJson(c.req.raw)
    )
    if (!parsed.success) return apiError(c, errors.invalidShift)
    const requests = parsed.output.plans
    if (new Set(requests.map(({ id }) => id)).size !== requests.length)
      return apiError(c, errors.invalidShift)
    const db = c.env.shift_app,
      actor = c.get("member")
    const candidates = await Promise.all(
      requests.map(async ({ id, plan }) => {
        const activity = await db
          .prepare("SELECT year FROM activities WHERE id=?")
          .bind(id)
          .first<{ year: number }>()
        if (!activity) return { failure: errors.activityNotFound }
        if (!(await canEditActivity(c.env, actor, id, activity.year)))
          return { failure: errors.shiftResponsibilityRequired }
        const item = await prepareActivitySave(db, id, plan, true)
        return { id, ...item }
      })
    )
    const prepared = []
    for (const item of candidates) {
      if ("failure" in item) return apiError(c, item.failure)
      prepared.push(item)
    }
    if (
      new Set(prepared.map(({ current }) => current.activity.year)).size !== 1
    )
      return apiError(c, errors.invalidShift)
    const guards: D1PreparedStatement[] = [],
      writes: D1PreparedStatement[] = []
    for (const item of prepared) {
      // A member removed here and added to another plan is a transfer, even if its times changed.
      for (const slot of item.current.slots)
        for (const memberId of slot.memberIds) {
          if (
            item.input.slots.some(
              (s) => s.id === slot.id && s.memberIds.includes(memberId)
            )
          )
            continue
          const destination = prepared.find(
            (other) =>
              other.id !== item.id &&
              other.input.slots.some(
                (s) =>
                  s.memberIds.includes(memberId) &&
                  !other.current.slots.some(
                    (old) => old.id === s.id && old.memberIds.includes(memberId)
                  )
              )
          )
          if (!destination) continue
          if (
            Date.parse(slot.endsAt) <= Date.now() ||
            item.current.assignmentStates.some(
              (state) =>
                state.slotId === slot.id &&
                state.memberId === memberId &&
                state.recorded
            )
          )
            return apiError(c, errors.assignmentTransferBlocked)
          // Recheck in the same transaction, before cancellation, including attendance written after the read.
          guards.push(
            db
              .prepare(`INSERT INTO activity_history(id,activity_id,actor_id,"before","after",created_at)
        VALUES (?,?,?,CASE WHEN EXISTS(
          SELECT 1 FROM (${activityPlanningAssignments}) a JOIN shift_slots s ON s.id=a.slotId
          WHERE a.slotId=? AND a.memberId=? AND s.deleted=0
          AND s.ends_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
          AND NOT EXISTS(SELECT 1 FROM assignment_attendance WHERE assignment_id=a.id)
          AND NOT EXISTS(SELECT 1 FROM assignment_attendance_events WHERE assignment_id=a.id)
        ) THEN ? ELSE NULL END,?,?)`)
              .bind(
                crypto.randomUUID(),
                item.id,
                actor.id,
                item.id,
                item.id,
                slot.id,
                memberId,
                JSON.stringify({ slotId: slot.id, memberId }),
                JSON.stringify({ transferTo: destination.id }),
                Date.now()
              )
          )
        }
    }
    const replacements = await Promise.all(
      prepared.map((item) =>
        shiftPlanStatements(db, item.id, actor.id, item.input, item.current)
      )
    )
    for (const [guard, ...replacement] of replacements) {
      if (!guard) throw new Error("Missing shift revision guard")
      guards.push(guard)
      writes.push(...replacement)
    }
    // Clear all affected assignments first. SQL overlap triggers then validate the final placements.
    const clear = prepared.flatMap(({ id }) => [
      db
        .prepare(
          "UPDATE shift_assignments SET status='cancelled',cancelled_by=?,cancelled_at=?,updated_at=? WHERE status='active' AND slot_id IN (SELECT id FROM shift_slots WHERE activity_id=?)"
        )
        .bind(actor.id, Date.now(), Date.now(), id),
      db
        .prepare(
          "DELETE FROM directory_shift_assignments WHERE slot_id IN (SELECT id FROM shift_slots WHERE activity_id=?)"
        )
        .bind(id),
    ])
    try {
      await db.batch([...guards, ...clear, ...writes])
    } catch (error) {
      if (
        error instanceof Error &&
        /activity_history.before/.test(error.message)
      )
        return apiError(c, errors.assignmentTransferChanged)
      if (
        error instanceof Error &&
        /SHIFT_OVERLAP|RESPONSIBLE_REQUIRED|YEAR_MEMBERSHIP_REQUIRED|FOREIGN KEY/.test(
          error.message
        )
      )
        return apiError(c, errors.shiftConflict)
      throw error
    }
    return c.json({
      activities: await Promise.all(
        prepared.map(({ id }) => readActivityEditor(db, id))
      ),
    })
  }
)
