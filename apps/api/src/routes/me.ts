import { Hono } from "hono"

import { timeWindowSchema } from "@workspace/shared/shifts"

import { apiError, type ApiEnv, toIso } from "../http"

const MAX_TIMELINE_RANGE_MS = 31 * 24 * 60 * 60 * 1000

type TimelineRow = {
  id: string
  activityId: string
  memberId: string
  memberDisplayName: string
  startsAt: number
  endsAt: number
  notes: string | null
  activityName: string
  place: string
  activityType: string
  color: string
  checkedInAt: number | null
}

export const meApp = new Hono<ApiEnv>()

meApp.get("/timeline", async (c) => {
  const range = timeWindowSchema.safeParse({
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

  const startsAt = Date.parse(range.data.startsAt)
  const endsAt = Date.parse(range.data.endsAt)
  if (endsAt - startsAt > MAX_TIMELINE_RANGE_MS) {
    return apiError(
      c,
      422,
      "TIME_RANGE_TOO_LARGE",
      "Timeline range must not exceed 31 days"
    )
  }

  const member = c.get("member")
  const assignments = await c.env.shift_app
    .prepare(
      `SELECT
         assignment.id,
         assignment.activity_id AS activityId,
         assignment.member_id AS memberId,
         member.display_name AS memberDisplayName,
         assignment.starts_at AS startsAt,
         assignment.ends_at AS endsAt,
         assignment.notes,
         activity.name AS activityName,
         activity.place,
         activity.activity_type AS activityType,
         activity.color,
         attendance.checked_in_at AS checkedInAt
       FROM shift_assignments assignment
       JOIN activities activity ON activity.id = assignment.activity_id
       JOIN members member ON member.id = assignment.member_id
       LEFT JOIN attendance_records attendance ON attendance.assignment_id = assignment.id
       WHERE assignment.member_id = ?
         AND assignment.status = 'active'
         AND assignment.starts_at < ?
         AND assignment.ends_at > ?
       ORDER BY assignment.starts_at, assignment.ends_at
       LIMIT 500`
    )
    .bind(member.id, endsAt, startsAt)
    .all<TimelineRow>()

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
