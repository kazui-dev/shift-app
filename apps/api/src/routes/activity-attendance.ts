import { Hono } from "hono"
import { apiError, type ApiEnv, toIso } from "../lib/http"
import { canManageActivity } from "../services/activity-access"
import {
  reportSelection,
  reportJson,
  type ReportRow,
} from "../services/assignment-reports"

export const activityAttendanceApp = new Hono<ApiEnv>()
activityAttendanceApp.get("/:activityId/attendance", async (c) => {
  const id = c.req.param("activityId")
  const activity = await c.env.shift_app
    .prepare("SELECT year FROM activities WHERE id=?")
    .bind(id)
    .first<{ year: number }>()
  if (!activity)
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "シフトが見つかりません")
  const actor = c.get("member")
  const canManage = await canManageActivity(c.env, actor, id, activity.year)
  if (!canManage) {
    const membership = await c.env.shift_app
      .prepare(
        "SELECT 1 FROM year_memberships WHERE year=? AND member_id=? AND status='active'"
      )
      .bind(activity.year, actor.id)
      .first()
    if (!membership)
      return apiError(c, 403, "FORBIDDEN", "年度への参加が必要です")
  }
  const assignments = await c.env.shift_app
    .prepare(`SELECT a.id, a.member_id AS memberId, m.display_name AS memberDisplayName,
    s.starts_at AS startsAt, s.ends_at AS endsAt, a.status = 'active' AS active, attendance.checked_in_at AS checkedInAt, attendance.status AS attendanceStatus
    FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id JOIN app_users m ON m.id=a.member_id
    LEFT JOIN attendance_records attendance ON attendance.assignment_id=a.id
    WHERE s.activity_id=? AND (? OR a.member_id=?) ORDER BY s.starts_at, m.student_id`)
    .bind(id, canManage ? 1 : 0, actor.id)
    .all<{
      id: string
      memberId: string
      memberDisplayName: string
      startsAt: number
      endsAt: number
      active: number
      checkedInAt: number | null
      attendanceStatus: "pending" | "confirmed" | null
    }>()
  const reports = await c.env.shift_app
    .prepare(
      `${reportSelection} WHERE activity.id=? AND (? OR r.member_id=?) ORDER BY r.updated_at DESC`
    )
    .bind(id, canManage ? 1 : 0, actor.id)
    .all<ReportRow>()
  return c.json({
    canManage,
    assignments: assignments.results.map((a) => ({
      ...a,
      own: a.memberId === actor.id,
      active: !!a.active,
      startsAt: toIso(a.startsAt),
      endsAt: toIso(a.endsAt),
      checkedInAt: a.checkedInAt === null ? null : toIso(a.checkedInAt),
    })),
    reports: reports.results.map(reportJson),
  })
})
