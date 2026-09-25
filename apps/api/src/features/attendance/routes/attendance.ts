import { type Context, Hono } from "hono"
import * as v from "valibot"

import {
  manageAttendanceInputSchema,
  submitAttendanceInputSchema,
} from "@workspace/shared/shifts"

import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, readJson } from "../../../lib/http"
import { listAttendanceEvents } from "../services/attendance-events"
import {
  announceAttendance,
  findShift,
  readAttendance,
  type ShiftRow,
} from "../services/assignment-attendance"
import {
  recordCheckIn,
  recordReport,
  withdrawReport,
  resolveReport,
  correctCheckIn,
} from "../services/attendance-commands"
import { canManageActivity } from "../../activities/services/activity-access"
import { broadcastChange } from "../../live/services/live-events"

const idSchema = v.pipe(v.string(), v.uuid())

export const attendanceApp = new Hono<ApiEnv>()

/** Answers with the attendance now recorded, and tells whoever watches the shift. */
async function changedAttendance(
  c: Context<ApiEnv>,
  shift: ShiftRow,
  assignmentId: string
) {
  c.executionCtx.waitUntil(
    broadcastChange(c.env, {
      type: "attendance_changed",
      activityId: shift.activityId,
    })
  )
  return c.json({ attendance: await readAttendance(c.env, assignmentId) })
}

/** A member checks in, or says they are late or absent, for their own active shift. */
attendanceApp.put("/:assignmentId/attendance", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  if (!id.success) return apiError(c, errors.assignmentNotFound)
  const input = v.safeParse(
    submitAttendanceInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) return apiError(c, errors.invalidAttendance)
  const member = c.get("member")
  const shift = await findShift(c.env, id.output)
  if (!shift || shift.memberId !== member.id || !shift.active)
    return apiError(c, errors.assignmentNotFound)
  if (input.output.state === "present") {
    if (
      !(await recordCheckIn(
        c.env.shift_app,
        id.output,
        member.id,
        input.output.locationConfirmed
      ))
    )
      return apiError(c, errors.attendanceChanged)
    return changedAttendance(c, shift, id.output)
  }
  if (shift.attendanceState === "present")
    return apiError(c, errors.attendanceFinal)
  const expectedAt =
    input.output.state === "late" && input.output.expectedAt
      ? Date.parse(input.output.expectedAt)
      : null
  if (
    !(await recordReport(
      c.env.shift_app,
      id.output,
      member.id,
      input.output.state,
      expectedAt,
      input.output.reason
    ))
  )
    return apiError(c, errors.attendanceFinal)
  c.executionCtx.waitUntil(
    announceAttendance(
      c.env,
      shift,
      input.output.state === "late"
        ? { state: "late", expectedAt, reason: input.output.reason }
        : { state: "absent", reason: input.output.reason }
    )
  )
  return changedAttendance(c, shift, id.output)
})

/** A member takes back being late or absent; a check-in cannot be taken back. */
attendanceApp.delete("/:assignmentId/attendance", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  if (!id.success) return apiError(c, errors.assignmentNotFound)
  const member = c.get("member")
  const shift = await findShift(c.env, id.output)
  if (!shift || shift.memberId !== member.id)
    return apiError(c, errors.assignmentNotFound)
  if (shift.attendanceState === "present")
    return apiError(c, errors.attendanceFinal)
  if (!(await withdrawReport(c.env.shift_app, id.output, member.id)))
    return apiError(c, errors.attendanceNotFound)
  c.executionCtx.waitUntil(
    Promise.all([
      announceAttendance(c.env, shift, {
        state: "withdrawn",
        previous: shift.attendanceState === "absent" ? "absent" : "late",
      }),
      broadcastChange(c.env, {
        type: "attendance_changed",
        activityId: shift.activityId,
      }),
    ])
  )
  return c.body(null, 204)
})

/** A responsible corrects a check-in, or marks late or absent as handled. */
attendanceApp.patch("/:assignmentId/attendance", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  if (!id.success) return apiError(c, errors.assignmentNotFound)
  const input = v.safeParse(
    manageAttendanceInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) return apiError(c, errors.attendanceReasonRequired)
  const shift = await findShift(c.env, id.output)
  if (!shift) return apiError(c, errors.assignmentNotFound)
  const actor = c.get("member")
  if (!(await canManageActivity(c.env, actor, shift.activityId, shift.year)))
    return apiError(c, errors.shiftResponsibilityRequired)
  if (input.output.action === "resolve") {
    if (!(await resolveReport(c.env.shift_app, id.output, actor.id)))
      return apiError(c, errors.attendanceChanged)
  } else {
    await correctCheckIn(
      c.env.shift_app,
      id.output,
      shift.memberId,
      actor.id,
      input.output.checkedInAt,
      input.output.reason
    )
  }
  return changedAttendance(c, shift, id.output)
})

/** Every change to an assignment's attendance, for its member and responsibles. */
attendanceApp.get("/:assignmentId/attendance/events", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  if (!id.success) return apiError(c, errors.assignmentNotFound)
  const shift = await findShift(c.env, id.output)
  if (!shift) return apiError(c, errors.assignmentNotFound)
  const member = c.get("member")
  if (
    member.id !== shift.memberId &&
    !(await canManageActivity(c.env, member, shift.activityId, shift.year))
  )
    return apiError(c, errors.attendanceViewForbidden)
  return c.json({
    events: await listAttendanceEvents(c.env.shift_app, id.output),
  })
})
