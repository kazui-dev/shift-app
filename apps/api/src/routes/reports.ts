import { Hono } from "hono"
import * as v from "valibot"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  readJson,
  toIso,
} from "../lib/http"

const idSchema = v.pipe(v.string(), v.uuid())

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
  year: number
  startsAt: number
  endsAt: number
  createdAt: number
  resolvedAt: number | null
}

function reportJson(report: ReportRow) {
  return {
    id: report.id,
    assignmentId: report.assignmentId,
    memberId: report.memberId,
    memberDisplayName: report.memberDisplayName,
    kind: report.kind,
    message: report.message,
    status: report.status,
    activityId: report.activityId,
    activityName: report.activityName,
    startsAt: toIso(report.startsAt),
    endsAt: toIso(report.endsAt),
    createdAt: toIso(report.createdAt),
    resolvedAt: report.resolvedAt === null ? null : toIso(report.resolvedAt),
  }
}

async function findReport(
  env: CloudflareBindings,
  id: string
): Promise<ReportRow | null> {
  return env.shift_app
    .prepare(
      `SELECT report.id, report.assignment_id AS assignmentId,
              report.member_id AS memberId, member.display_name AS memberDisplayName,
              report.kind, report.message, report.status,
              activity.id AS activityId, activity.name AS activityName, activity.year,
              assignment.starts_at AS startsAt, assignment.ends_at AS endsAt,
              report.created_at AS createdAt, report.resolved_at AS resolvedAt
       FROM assignment_reports report
       JOIN shift_assignments assignment ON assignment.id = report.assignment_id
       JOIN activities activity ON activity.id = assignment.activity_id
       JOIN members member ON member.id = report.member_id
       WHERE report.id = ?`
    )
    .bind(id)
    .first<ReportRow>()
}

export const reportsApp = new Hono<ApiEnv>()

reportsApp.patch("/:reportId", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("reportId"))
  if (!id.success) {
    return apiError(c, 404, "REPORT_NOT_FOUND", "Report not found")
  }
  const report = await findReport(c.env, id.output)
  if (!report) {
    return apiError(c, 404, "REPORT_NOT_FOUND", "Report not found")
  }
  const input = v.safeParse(
    v.object({ status: v.literal("resolved") }),
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(c, 422, "INVALID_REPORT_UPDATE", "Invalid report update")
  }
  const actor = c.get("member")
  if (!(await canManageShifts(c.env, actor, report.year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  if (report.status === "resolved") {
    return c.json({ report: reportJson(report) })
  }
  const now = Date.now()
  await c.env.shift_app
    .prepare(
      `UPDATE assignment_reports
       SET status = 'resolved', resolved_by = ?, resolved_at = ?, updated_at = ?
       WHERE id = ? AND status = 'open'`
    )
    .bind(actor.id, now, now, report.id)
    .run()
  return c.json({
    report: reportJson({
      ...report,
      status: "resolved",
      resolvedAt: now,
    }),
  })
})
