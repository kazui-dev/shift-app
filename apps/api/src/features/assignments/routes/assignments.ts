import { type Context, Hono } from "hono"
import * as v from "valibot"

import {
  manageAttendanceInputSchema,
  submitAttendanceInputSchema,
} from "@workspace/shared/shifts"

import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, readJson, toIso } from "../../../lib/http"
import { canManageActivity } from "../../activities/services/activity-access"
import {
  attendanceColumns,
  attendanceJson,
  type AttendanceColumns,
} from "../../attendance/services/attendance"
import {
  attendanceNotice,
  type AttendanceReport,
} from "../../attendance/domain/attendance-notice"
import { postBotMessage } from "../../chat/services/bots"
import { broadcastChange } from "../../live/services/live-events"

const idSchema = v.pipe(v.string(), v.uuid())

export const assignmentsApp = new Hono<ApiEnv>()

type ShiftRow = {
  assignmentId: string
  memberId: string
  memberDisplayName: string
  activityId: string
  activityName: string
  year: number
  active: number
  startsAt: number
  endsAt: number
  roomId: string | null
} & AttendanceColumns

/** An assignment with its shift and attendance, whoever it belongs to. */
function findShift(env: CloudflareBindings, assignmentId: string) {
  return env.shift_app
    .prepare(`SELECT a.id AS assignmentId, a.member_id AS memberId, m.display_name AS memberDisplayName,
    activity.id AS activityId, activity.name AS activityName, activity.year,
    s.starts_at AS startsAt, s.ends_at AS endsAt, room.room_id AS roomId,
    (a.status = 'active' AND activity.active = 1 AND EXISTS (
      SELECT 1 FROM year_memberships ym WHERE ym.member_id = a.member_id AND ym.year = activity.year AND ym.status = 'active'
    )) AS active, ${attendanceColumns}
    FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id
    JOIN activities activity ON activity.id = s.activity_id JOIN app_users m ON m.id = a.member_id
    LEFT JOIN assignment_attendance attendance ON attendance.assignment_id = a.id
    LEFT JOIN activity_chat_rooms room ON room.activity_id = activity.id
    WHERE a.id = ?`)
    .bind(assignmentId)
    .first<ShiftRow>()
}

/**
 * Posts the shift room's notice about what a member reported, for the member
 * and the shift's keepers alone: a reason is theirs to share.
 */
function announceAttendance(
  env: CloudflareBindings,
  shift: ShiftRow,
  report: AttendanceReport
) {
  if (!shift.roomId) return Promise.resolve(null)
  const notice = attendanceNotice({
    ...report,
    displayName: shift.memberDisplayName,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  })
  return postBotMessage(env, {
    roomId: shift.roomId,
    key: "attendance",
    about: { memberId: shift.memberId, displayName: shift.memberDisplayName },
    private: true,
    ...notice,
  })
}

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

async function readAttendance(env: CloudflareBindings, assignmentId: string) {
  const shift = await findShift(env, assignmentId)
  return shift ? attendanceJson(shift) : null
}

/** A member checks in, or says they are late or absent, for their own active shift. */
assignmentsApp.put("/:assignmentId/attendance", async (c) => {
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
  const now = Date.now()
  const db = c.env.shift_app
  if (input.output.state === "present") {
    // A check-in stays as first recorded; later ones change nothing.
    const [result] = await db.batch([
      db
        .prepare(`INSERT INTO assignment_attendance
        (assignment_id, member_id, state, expected_at, reason, checked_in_at, check_in_status, created_at, updated_at)
        VALUES (?, ?, 'present', NULL, '', ?, ?, ?, ?)
        ON CONFLICT(assignment_id) DO UPDATE SET state = 'present', checked_in_at = excluded.checked_in_at,
        check_in_status = excluded.check_in_status, updated_at = MAX(excluded.updated_at, assignment_attendance.updated_at + 1)
        WHERE assignment_attendance.state <> 'present'`)
        .bind(
          id.output,
          member.id,
          now,
          input.output.locationConfirmed ? "confirmed" : "pending",
          now,
          now
        ),
      db
        .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, checked_in_at, created_at)
        SELECT ?, ?, ?, 'checked_in', ?, ? WHERE changes() > 0`)
        .bind(crypto.randomUUID(), id.output, member.id, now, now),
    ])
    if (!result) return apiError(c, errors.attendanceChanged)
    return changedAttendance(c, shift, id.output)
  }
  if (shift.attendanceState === "present")
    return apiError(c, errors.attendanceFinal)
  const expectedAt =
    input.output.state === "late" && input.output.expectedAt
      ? Date.parse(input.output.expectedAt)
      : null
  const [result] = await db.batch([
    db
      .prepare(`INSERT INTO assignment_attendance
      (assignment_id, member_id, state, expected_at, reason, checked_in_at, check_in_status, resolved_by, resolved_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET state = excluded.state, expected_at = excluded.expected_at,
      reason = excluded.reason, resolved_by = NULL, resolved_at = NULL,
      updated_at = MAX(excluded.updated_at, assignment_attendance.updated_at + 1)
      WHERE assignment_attendance.state <> 'present'`)
      .bind(
        id.output,
        member.id,
        input.output.state,
        expectedAt,
        input.output.reason,
        now,
        now
      ),
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, expected_at, reason, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`)
      .bind(
        crypto.randomUUID(),
        id.output,
        member.id,
        input.output.state,
        expectedAt,
        input.output.reason,
        now
      ),
  ])
  if (!result || result.meta.changes === 0)
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
assignmentsApp.delete("/:assignmentId/attendance", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  if (!id.success) return apiError(c, errors.assignmentNotFound)
  const member = c.get("member")
  const shift = await findShift(c.env, id.output)
  if (!shift || shift.memberId !== member.id)
    return apiError(c, errors.assignmentNotFound)
  if (shift.attendanceState === "present")
    return apiError(c, errors.attendanceFinal)
  const db = c.env.shift_app
  const now = Date.now()
  const [result] = await db.batch([
    db
      .prepare(
        "DELETE FROM assignment_attendance WHERE assignment_id = ? AND member_id = ? AND state IN ('late', 'absent')"
      )
      .bind(id.output, member.id),
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, created_at)
      SELECT ?, ?, ?, 'withdrawn', ? WHERE changes() > 0`)
      .bind(crypto.randomUUID(), id.output, member.id, now),
  ])
  if (!result || result.meta.changes === 0)
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
assignmentsApp.patch("/:assignmentId/attendance", async (c) => {
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
  const db = c.env.shift_app
  const now = Date.now()
  if (input.output.action === "resolve") {
    const [result] = await db.batch([
      db
        .prepare(`UPDATE assignment_attendance SET resolved_by = ?, resolved_at = ?, updated_at = MAX(?, updated_at + 1)
        WHERE assignment_id = ? AND state IN ('late', 'absent') AND resolved_at IS NULL`)
        .bind(actor.id, now, now, id.output),
      db
        .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, created_at)
        SELECT ?, ?, ?, 'resolved', ? WHERE changes() > 0`)
        .bind(crypto.randomUUID(), id.output, actor.id, now),
    ])
    if (!result || result.meta.changes === 0)
      return apiError(c, errors.attendanceChanged)
    return changedAttendance(c, shift, id.output)
  }
  const at = Date.parse(input.output.checkedInAt)
  await db.batch([
    db
      .prepare(`INSERT INTO assignment_attendance_events (id, assignment_id, actor_id, action, checked_in_at, previous_checked_in_at, reason, created_at)
      VALUES (?, ?, ?, 'corrected', ?, (SELECT checked_in_at FROM assignment_attendance WHERE assignment_id = ?), ?, ?)`)
      .bind(
        crypto.randomUUID(),
        id.output,
        actor.id,
        at,
        id.output,
        input.output.reason,
        now
      ),
    db
      .prepare(`INSERT INTO assignment_attendance
      (assignment_id, member_id, state, expected_at, reason, checked_in_at, check_in_status, created_at, updated_at)
      VALUES (?, ?, 'present', NULL, '', ?, 'confirmed', ?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET state = 'present', checked_in_at = excluded.checked_in_at,
      check_in_status = 'confirmed', updated_at = MAX(excluded.updated_at, assignment_attendance.updated_at + 1)`)
      .bind(id.output, shift.memberId, at, now, now),
  ])
  return changedAttendance(c, shift, id.output)
})

/** Every change to an assignment's attendance, for its member and responsibles. */
assignmentsApp.get("/:assignmentId/attendance/events", async (c) => {
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
  const events = await c.env.shift_app
    .prepare(`SELECT e.id, m.display_name AS actor, e.action, e.expected_at AS expectedAt,
    e.checked_in_at AS checkedInAt, e.previous_checked_in_at AS previousCheckedInAt, e.reason,
    e.created_at AS createdAt
    FROM assignment_attendance_events e JOIN app_users m ON m.id = e.actor_id
    WHERE e.assignment_id = ? ORDER BY e.created_at DESC, e.id`)
    .bind(id.output)
    .all<{
      id: string
      actor: string
      action:
        | "late"
        | "absent"
        | "withdrawn"
        | "checked_in"
        | "corrected"
        | "resolved"
      expectedAt: number | null
      checkedInAt: number | null
      previousCheckedInAt: number | null
      reason: string
      createdAt: number
    }>()
  const iso = (value: number | null) => (value === null ? null : toIso(value))
  return c.json({
    events: events.results.map((event) => ({
      ...event,
      expectedAt: iso(event.expectedAt),
      checkedInAt: iso(event.checkedInAt),
      previousCheckedInAt: iso(event.previousCheckedInAt),
      createdAt: toIso(event.createdAt),
    })),
  })
})
