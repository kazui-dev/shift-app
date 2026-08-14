import { Hono } from "hono"
import { z } from "zod"

import { apiError, type ApiEnv, canManageShifts, toIso } from "../http"
import { isCheckInTime } from "../attendance"

const idSchema = z.string().uuid()

type AssignmentRow = {
  id: string
  year: number
  yearStatus: "draft" | "active" | "archived"
  status: "active" | "cancelled"
}

export const assignmentsApp = new Hono<ApiEnv>()

assignmentsApp.post("/:assignmentId/check-in", async (c) => {
  const id = idSchema.safeParse(c.req.param("assignmentId"))
  if (!id.success) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }
  const member = c.get("member")
  const assignment = await c.env.shift_app
    .prepare(
      `SELECT assignment.id, assignment.starts_at AS startsAt,
              assignment.ends_at AS endsAt, attendance.id AS attendanceId,
              attendance.checked_in_at AS checkedInAt
       FROM shift_assignments assignment
       LEFT JOIN attendance_records attendance ON attendance.assignment_id = assignment.id
       WHERE assignment.id = ? AND assignment.member_id = ?
         AND assignment.status = 'active'`
    )
    .bind(id.data, member.id)
    .first<{
      id: string
      startsAt: number
      endsAt: number
      attendanceId: string | null
      checkedInAt: number | null
    }>()
  if (!assignment) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }
  if (assignment.attendanceId && assignment.checkedInAt !== null) {
    return c.json({
      attendance: {
        id: assignment.attendanceId,
        assignmentId: assignment.id,
        checkedInAt: toIso(assignment.checkedInAt),
      },
    })
  }

  const now = Date.now()
  if (!isCheckInTime(now, assignment.startsAt, assignment.endsAt)) {
    return apiError(
      c,
      409,
      "OUTSIDE_ASSIGNMENT_TIME",
      "Check-in is only available during the assignment"
    )
  }

  const attendanceId = crypto.randomUUID()
  const result = await c.env.shift_app
    .prepare(
      `INSERT OR IGNORE INTO attendance_records
        (id, assignment_id, member_id, checked_in_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(attendanceId, assignment.id, member.id, now, now, now)
    .run()
  if (result.meta.changes !== 1) {
    const existing = await c.env.shift_app
      .prepare(
        `SELECT id, checked_in_at AS checkedInAt
         FROM attendance_records WHERE assignment_id = ?`
      )
      .bind(assignment.id)
      .first<{ id: string; checkedInAt: number }>()
    if (existing) {
      return c.json({
        attendance: {
          id: existing.id,
          assignmentId: assignment.id,
          checkedInAt: toIso(existing.checkedInAt),
        },
      })
    }
    return apiError(
      c,
      409,
      "CHECK_IN_CONFLICT",
      "Check-in could not be recorded"
    )
  }
  return c.json(
    {
      attendance: {
        id: attendanceId,
        assignmentId: assignment.id,
        checkedInAt: toIso(now),
      },
    },
    201
  )
})

assignmentsApp.delete("/:assignmentId", async (c) => {
  const id = idSchema.safeParse(c.req.param("assignmentId"))
  if (!id.success) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }

  const assignment = await c.env.shift_app
    .prepare(
      `SELECT assignment.id, activity.year, operating_year.status AS yearStatus,
              assignment.status
       FROM shift_assignments assignment
       JOIN activities activity ON activity.id = assignment.activity_id
       JOIN operating_years operating_year ON operating_year.year = activity.year
       WHERE assignment.id = ?`
    )
    .bind(id.data)
    .first<AssignmentRow>()
  if (!assignment) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }

  const actor = c.get("member")
  if (!(await canManageShifts(c.env, actor, assignment.year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  if (assignment.status === "cancelled") {
    return c.body(null, 204)
  }
  if (assignment.yearStatus === "archived") {
    return apiError(c, 409, "YEAR_NOT_EDITABLE", "Operating year is archived")
  }
  const now = Date.now()
  await c.env.shift_app
    .prepare(
      `UPDATE shift_assignments
       SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`
    )
    .bind(actor.id, now, now, assignment.id)
    .run()
  return c.body(null, 204)
})
