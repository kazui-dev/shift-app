import { Hono } from "hono"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  parseYear,
  toIso,
} from "../../lib/http"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearReportsApp = new Hono<ApiEnv>()

yearReportsApp.get("/:year/reports", async (c) => {
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
  const reports = await c.env.shift_app
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
       WHERE activity.year = ?
       ORDER BY report.status = 'resolved', report.created_at DESC
       LIMIT 500`
    )
    .bind(year)
    .all<{
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
    }>()
  return c.json({
    reports: reports.results.map((report) => ({
      ...report,
      startsAt: toIso(report.startsAt),
      endsAt: toIso(report.endsAt),
      createdAt: toIso(report.createdAt),
      resolvedAt: report.resolvedAt === null ? null : toIso(report.resolvedAt),
    })),
  })
})
