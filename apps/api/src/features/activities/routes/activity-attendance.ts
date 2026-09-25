import { Hono } from "hono"
import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, toIso } from "../../../lib/http"
import { canManageActivity } from "../services/activity-access"
import {
  attendanceColumns,
  withAttendance,
  type AttendanceColumns,
} from "../../attendance/services/attendance"

export const activityAttendanceApp = new Hono<ApiEnv>()
activityAttendanceApp.get("/:activityId/attendance", async (c) => {
  const id = c.req.param("activityId")
  const activity = await c.env.shift_app
    .prepare("SELECT year FROM activities WHERE id=?")
    .bind(id)
    .first<{ year: number }>()
  if (!activity) return apiError(c, errors.activityNotFound)
  const actor = c.get("member")
  const canManage = await canManageActivity(c.env, actor, id, activity.year)
  if (!canManage) {
    const membership = await c.env.shift_app
      .prepare(
        "SELECT 1 FROM year_memberships WHERE year=? AND member_id=? AND status='active'"
      )
      .bind(activity.year, actor.id)
      .first()
    if (!membership) return apiError(c, errors.yearMembershipRequired)
  }
  // Responsibles see everyone's attendance; others only their own.
  const assignments = await c.env.shift_app
    .prepare(`SELECT a.id, a.member_id AS memberId, m.display_name AS memberDisplayName,
    s.starts_at AS startsAt, s.ends_at AS endsAt, a.status = 'active' AS active, ${attendanceColumns}
    FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id JOIN app_users m ON m.id=a.member_id
    LEFT JOIN assignment_attendance attendance ON attendance.assignment_id=a.id
    WHERE s.activity_id=? AND (? OR a.member_id=?) ORDER BY s.starts_at, m.student_id`)
    .bind(id, canManage ? 1 : 0, actor.id)
    .all<
      {
        id: string
        memberId: string
        memberDisplayName: string
        startsAt: number
        endsAt: number
        active: number
      } & AttendanceColumns
    >()
  return c.json({
    canManage,
    assignments: assignments.results.map((row) => {
      const assignment = withAttendance(row)
      return {
        ...assignment,
        own: assignment.memberId === actor.id,
        active: !!assignment.active,
        startsAt: toIso(assignment.startsAt),
        endsAt: toIso(assignment.endsAt),
      }
    }),
  })
})
