import { Hono } from "hono"

import {
  groupAvailabilitySubmissions,
  type AvailabilityManagerRow,
} from "../../domain/year-projections"
import {
  apiError,
  type ApiEnv,
  canManageShifts,
  parseYear,
} from "../../lib/http"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const availabilitySubmissionsApp = new Hono<ApiEnv>()

availabilitySubmissionsApp.get("/:year/availability-submissions", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canManageShifts(c.env, c.get("member"), year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  const rows = await c.env.shift_app
    .prepare(
      `SELECT
         submission.id AS submissionId,
         member.id AS memberId,
         member.display_name AS displayName,
         member.student_id AS studentId,
         submission.status,
         submission.submitted_at AS submittedAt,
         window.id AS windowId,
         availability_date.date,
         window.starts_at AS startsAt,
         window.ends_at AS endsAt
       FROM availability_submissions submission
       JOIN members member ON member.id = submission.member_id
       LEFT JOIN availability_windows window ON window.submission_id = submission.id
       LEFT JOIN availability_dates availability_date
         ON availability_date.id = window.availability_date_id
       WHERE submission.year = ?
       ORDER BY lower(member.display_name), window.starts_at`
    )
    .bind(year)
    .all<AvailabilityManagerRow>()

  return c.json({
    submissions: groupAvailabilitySubmissions(rows.results),
  })
})
