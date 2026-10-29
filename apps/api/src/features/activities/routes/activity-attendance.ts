import { Hono } from "hono"
import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, toIso } from "../../../lib/http"
import { canManageActivity } from "../../../auth/authorization/activity"
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
    .prepare(`SELECT a.id, a.member_id AS memberId, m.display_name AS memberDisplayName, m.student_id AS memberStudentId,
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
        memberStudentId: string
        startsAt: number
        endsAt: number
        active: number
      } & AttendanceColumns
    >()
  const duties = await c.env.shift_app
    .prepare(`SELECT DISTINCT mr.member_id AS memberId, r.name, r.position
      FROM member_year_roles mr JOIN year_roles r ON r.id=mr.role_id
      JOIN duties d ON d.role_id=r.id
      JOIN shift_assignments a ON a.member_id=mr.member_id
      JOIN shift_slots s ON s.id=a.slot_id
      WHERE s.activity_id=? AND r.year=? AND (? OR a.member_id=?)
      ORDER BY r.position DESC, r.name`)
    .bind(id, activity.year, canManage ? 1 : 0, actor.id)
    .all<{ memberId: string; name: string; position: number }>()
  const memberDuties = new Map<string, string[]>()
  for (const duty of duties.results) {
    const names = memberDuties.get(duty.memberId) ?? []
    names.push(duty.name)
    memberDuties.set(duty.memberId, names)
  }
  return c.json({
    canManage,
    assignments: assignments.results.map((row) => {
      const assignment = withAttendance(row)
      return {
        ...assignment,
        own: assignment.memberId === actor.id,
        memberDuties: memberDuties.get(assignment.memberId) ?? [],
        active: !!assignment.active,
        startsAt: toIso(assignment.startsAt),
        endsAt: toIso(assignment.endsAt),
      }
    }),
  })
})
