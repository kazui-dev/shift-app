import {
  reportSelection,
  reportJson,
  notifyReport,
  type ReportRow,
} from "../services/assignment-reports"
import { Hono } from "hono"
import * as v from "valibot"

import {
  checkInInputSchema,
  correctAttendanceInputSchema,
  createAssignmentReportInputSchema,
} from "@workspace/shared/shifts"

import { canManageActivity } from "../services/activity-access"
import { apiError, type ApiEnv, readJson, toIso } from "../lib/http"

const idSchema = v.pipe(v.string(), v.uuid())

export const assignmentsApp = new Hono<ApiEnv>()

assignmentsApp.put("/:assignmentId/report", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  const input = v.safeParse(
    createAssignmentReportInputSchema,
    await readJson(c.req.raw)
  )
  if (!id.success)
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "シフトが見つかりません")
  if (!input.success)
    return apiError(c, 422, "INVALID_REPORT", "連絡内容を確認してください")
  const member = c.get("member")
  const now = Date.now()
  const [result] = await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(`INSERT INTO assignment_reports
      (id, assignment_id, member_id, kind, message, eta, status, resolved_by, resolved_at, created_at, updated_at)
      SELECT ?, a.id, a.member_id, ?, ?, ?, 'open', NULL, NULL, ?, ?
      FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id JOIN activities activity ON activity.id = s.activity_id
      JOIN year_memberships ym ON ym.member_id = a.member_id AND ym.year = activity.year AND ym.status = 'active'
      WHERE a.id = ? AND a.member_id = ? AND a.status = 'active' AND activity.active = 1
      ON CONFLICT(assignment_id) DO UPDATE SET kind=excluded.kind, message=excluded.message, eta=excluded.eta,
      status='open', resolved_by=NULL, resolved_at=NULL, updated_at=MAX(excluded.updated_at, assignment_reports.updated_at + 1)`)
      .bind(
        crypto.randomUUID(),
        input.output.kind,
        input.output.message,
        input.output.kind === "late" && input.output.eta
          ? Date.parse(input.output.eta)
          : null,
        now,
        now,
        id.output,
        member.id
      ),
    c.env.shift_app
      .prepare(`INSERT INTO report_events (id, report_id, actor_id, action, details, created_at)
      SELECT ?, id, ?, 'submitted', ?, ? FROM assignment_reports WHERE assignment_id = ? AND member_id = ? AND changes() > 0`)
      .bind(
        crypto.randomUUID(),
        member.id,
        JSON.stringify(input.output),
        now,
        id.output,
        member.id
      ),
  ])
  if (!result || result.meta.changes === 0)
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "シフトが見つかりません")
  const report = await c.env.shift_app
    .prepare(`${reportSelection} WHERE r.assignment_id = ?`)
    .bind(id.output)
    .first<ReportRow>()
  if (!report) return apiError(c, 409, "REPORT_CHANGED", "連絡が変更されました")
  c.executionCtx.waitUntil(notifyReport(c.env, report))
  return c.json({ report: reportJson(report) })
})

assignmentsApp.put("/:assignmentId/attendance", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  const input = v.safeParse(checkInInputSchema, await readJson(c.req.raw))
  if (!id.success)
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "シフトが見つかりません")
  if (!input.success)
    return apiError(c, 422, "INVALID_ATTENDANCE", "出勤情報を確認してください")
  const member = c.get("member")
  const now = Date.now()
  await c.env.shift_app
    .prepare(`INSERT OR IGNORE INTO attendance_records
    (id, assignment_id, member_id, checked_in_at, status, created_at, updated_at)
    SELECT ?, a.id, a.member_id, ?, ?, ?, ? FROM shift_assignments a
    JOIN shift_slots s ON s.id = a.slot_id JOIN activities activity ON activity.id = s.activity_id
    JOIN year_memberships ym ON ym.member_id = a.member_id AND ym.year = activity.year AND ym.status = 'active'
    WHERE a.id = ? AND a.member_id = ? AND a.status = 'active' AND activity.active = 1`)
    .bind(
      crypto.randomUUID(),
      now,
      input.output.locationConfirmed ? "confirmed" : "pending",
      now,
      now,
      id.output,
      member.id
    )
    .run()
  const attendance = await c.env.shift_app
    .prepare(`SELECT id, assignment_id AS assignmentId, checked_in_at AS checkedInAt, status
    FROM attendance_records WHERE assignment_id = ? AND member_id = ?`)
    .bind(id.output, member.id)
    .first<{
      id: string
      assignmentId: string
      checkedInAt: number
      status: "pending" | "confirmed"
    }>()
  if (!attendance)
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "シフトが見つかりません")
  return c.json({
    attendance: { ...attendance, checkedInAt: toIso(attendance.checkedInAt) },
  })
})

assignmentsApp.patch("/:assignmentId/attendance", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("assignmentId"))
  const input = v.safeParse(
    correctAttendanceInputSchema,
    await readJson(c.req.raw)
  )
  if (!id.success)
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "シフトが見つかりません")
  if (!input.success)
    return apiError(
      c,
      422,
      "INVALID_ATTENDANCE",
      "出勤時刻と理由を入力してください"
    )
  const assignment = await c.env.shift_app
    .prepare(`SELECT a.member_id AS memberId, activity.id AS activityId, activity.year
    FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id JOIN activities activity ON activity.id = s.activity_id
    WHERE a.id = ?`)
    .bind(id.output)
    .first<{ memberId: string; activityId: string; year: number }>()
  if (!assignment)
    return apiError(c, 404, "ASSIGNMENT_NOT_FOUND", "シフトが見つかりません")
  const actor = c.get("member")
  if (
    !(await canManageActivity(
      c.env,
      actor,
      assignment.activityId,
      assignment.year
    ))
  )
    return apiError(c, 403, "FORBIDDEN", "責任者の権限が必要です")
  const now = Date.now()
  const at = Date.parse(input.output.checkedInAt)
  await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(`INSERT INTO attendance_events (id, assignment_id, actor_id, before, after, reason, created_at)
      VALUES (?, ?, ?, (SELECT checked_in_at FROM attendance_records WHERE assignment_id = ?), ?, ?, ?)`)
      .bind(
        crypto.randomUUID(),
        id.output,
        actor.id,
        id.output,
        at,
        input.output.reason,
        now
      ),
    c.env.shift_app
      .prepare(`INSERT INTO attendance_records (id, assignment_id, member_id, checked_in_at, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'confirmed', ?, ?) ON CONFLICT(assignment_id) DO UPDATE SET checked_in_at = excluded.checked_in_at, status = 'confirmed', updated_at = excluded.updated_at`)
      .bind(crypto.randomUUID(), id.output, assignment.memberId, at, now, now),
  ])
  const attendance = await c.env.shift_app
    .prepare("SELECT id FROM attendance_records WHERE assignment_id = ?")
    .bind(id.output)
    .first<{ id: string }>()
  if (!attendance)
    return apiError(c, 409, "ATTENDANCE_CONFLICT", "出勤記録が変更されました")
  return c.json({
    attendance: {
      id: attendance.id,
      assignmentId: id.output,
      checkedInAt: toIso(at),
      status: "confirmed",
    },
  })
})
