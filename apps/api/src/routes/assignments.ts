import { Hono } from "hono"
import { z } from "zod"

import { createAssignmentReportInputSchema } from "@workspace/shared/shifts"

import { isCheckInTime } from "../attendance"
import {
  apiError,
  type ApiEnv,
  canManageShifts,
  readJson,
  toIso,
} from "../http"

const idSchema = z.string().uuid()

type AssignmentRow = {
  id: string
  year: number
  yearStatus: "draft" | "active" | "archived"
  status: "active" | "cancelled"
}

type ReportRow = {
  id: string
  assignmentId: string
  memberId: string
  memberDisplayName: string
  kind: "late" | "absence"
  message: string
  status: "open" | "resolved"
  activityId: string
  activityName: string
  startsAt: number
  endsAt: number
  createdAt: number
  resolvedAt: number | null
}

function reportJson(report: ReportRow) {
  return {
    ...report,
    startsAt: toIso(report.startsAt),
    endsAt: toIso(report.endsAt),
    createdAt: toIso(report.createdAt),
    resolvedAt: report.resolvedAt === null ? null : toIso(report.resolvedAt),
  }
}

export const assignmentsApp = new Hono<ApiEnv>()

assignmentsApp.post("/:assignmentId/report", async (c) => {
  const id = idSchema.safeParse(c.req.param("assignmentId"))
  if (!id.success) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }
  const input = createAssignmentReportInputSchema.safeParse(
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_REPORT",
      input.error.issues[0]?.message ?? "Invalid report"
    )
  }
  const member = c.get("member")
  const reportId = crypto.randomUUID()
  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT INTO assignment_reports
        (id, assignment_id, member_id, kind, message, status,
         resolved_by, resolved_at, created_at, updated_at)
       SELECT ?, assignment.id, assignment.member_id, ?, ?, 'open',
              NULL, NULL, ?, ?
       FROM shift_assignments assignment
       WHERE assignment.id = ? AND assignment.member_id = ?
         AND assignment.status = 'active'
       ON CONFLICT(assignment_id) DO UPDATE SET
         kind = excluded.kind,
         message = excluded.message,
         status = 'open',
         resolved_by = NULL,
         resolved_at = NULL,
         updated_at = excluded.updated_at`
    )
    .bind(
      reportId,
      input.data.kind,
      input.data.message,
      now,
      now,
      id.data,
      member.id
    )
    .run()
  if (result.meta.changes !== 1) {
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "Assignment not found")
  }

  const report = await c.env.shift_app
    .prepare(
      `SELECT report.id, report.assignment_id AS assignmentId,
              report.member_id AS memberId, member.display_name AS memberDisplayName,
              report.kind, report.message, report.status,
              activity.id AS activityId, activity.name AS activityName,
              assignment.starts_at AS startsAt, assignment.ends_at AS endsAt,
              report.created_at AS createdAt, report.resolved_at AS resolvedAt
       FROM assignment_reports report
       JOIN shift_assignments assignment ON assignment.id = report.assignment_id
       JOIN activities activity ON activity.id = assignment.activity_id
       JOIN members member ON member.id = report.member_id
       WHERE report.assignment_id = ?`
    )
    .bind(id.data)
    .first<ReportRow>()
  if (!report) {
    return apiError(c, 500, "REPORT_READ_FAILED", "Report could not be read")
  }
  return c.json({ report: reportJson(report) }, 201)
})

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
