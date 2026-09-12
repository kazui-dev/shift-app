import { Hono } from "hono"
import * as v from "valibot"

import { timeWindowSchema } from "@workspace/shared/shifts"

import { apiError, type ApiEnv, parseYear, toIso } from "../../lib/http"

const MAX_ASSIGNMENT_RANGE_MS = 31 * 24 * 60 * 60 * 1000

type AssignmentRow = {
  id: string
  activityId: string
  roomId: string | null
  memberId: string
  memberDisplayName: string
  startsAt: number
  endsAt: number
  notes: string | null
  activityName: string
  place: string
  activityType: string
  color: string
  attendanceStatus: "pending" | "confirmed" | null
  checkedInAt: number | null
}

export const meAssignmentsApp = new Hono<ApiEnv>()

meAssignmentsApp.get("/assignments", async (c) => {
  const year = parseYear(c.req.query("year") ?? "")
  if (year === null) return apiError(c, 422, "INVALID_YEAR", "Year is required")
  const range = v.safeParse(timeWindowSchema, {
    startsAt: c.req.query("from"),
    endsAt: c.req.query("to"),
  })
  if (!range.success) {
    return apiError(
      c,
      422,
      "INVALID_TIME_RANGE",
      "from and to must be valid ISO 8601 timestamps"
    )
  }

  const startsAt = Date.parse(range.output.startsAt)
  const endsAt = Date.parse(range.output.endsAt)
  if (endsAt - startsAt > MAX_ASSIGNMENT_RANGE_MS) {
    return apiError(
      c,
      422,
      "TIME_RANGE_TOO_LARGE",
      "Assignment range must not exceed 31 days"
    )
  }

  const member = c.get("member")
  const assignments = await c.env.shift_app
    .prepare(
      `SELECT
         assignment.id,
         slot.activity_id AS activityId,
         chat.room_id AS roomId,
         assignment.member_id AS memberId,
         member.display_name AS memberDisplayName,
         slot.starts_at AS startsAt,
         slot.ends_at AS endsAt,
         assignment.notes,
         activity.name AS activityName,
         activity.place,
         activity.activity_type AS activityType,
         activity.color,
         attendance.checked_in_at AS checkedInAt, attendance.status AS attendanceStatus
       FROM shift_assignments assignment
       JOIN shift_slots slot ON slot.id = assignment.slot_id
       JOIN activities activity ON activity.id = slot.activity_id
       LEFT JOIN activity_chat_rooms chat ON chat.activity_id=activity.id
       JOIN year_memberships year_membership
         ON year_membership.year = activity.year
        AND year_membership.member_id = assignment.member_id
        AND year_membership.status = 'active'
       JOIN app_users member ON member.id = assignment.member_id
       LEFT JOIN attendance_records attendance ON attendance.assignment_id = assignment.id
       WHERE assignment.member_id = ? AND activity.year = ?
         AND assignment.status = 'active' AND activity.active = 1
         AND slot.starts_at < ?
         AND slot.ends_at > ?
       ORDER BY slot.starts_at, slot.ends_at
       LIMIT 500`
    )
    .bind(member.id, year, endsAt, startsAt)
    .all<AssignmentRow>()

  return c.json({
    assignments: assignments.results.map((assignment) => ({
      ...assignment,
      startsAt: toIso(assignment.startsAt),
      endsAt: toIso(assignment.endsAt),
      checkedInAt:
        assignment.checkedInAt === null ? null : toIso(assignment.checkedInAt),
    })),
  })
})
