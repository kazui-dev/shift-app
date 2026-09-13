import { Hono } from "hono"
import * as v from "valibot"
import { reportStateInputSchema } from "@workspace/shared/shifts"
import { apiError, errors } from "../lib/errors"
import { type ApiEnv, readJson, toIso } from "../lib/http"
import { canManageActivity } from "../services/activity-access"
import {
  reportSelection,
  reportJson,
  notifyReport,
  type ReportRow,
} from "../services/assignment-reports"

export const reportsApp = new Hono<ApiEnv>()
reportsApp.get("/:reportId/events", async (c) => {
  const report = await c.env.shift_app
    .prepare(`${reportSelection} WHERE r.id = ?`)
    .bind(c.req.param("reportId"))
    .first<ReportRow>()
  if (!report) return apiError(c, errors.reportNotFound)
  const actor = c.get("member")
  if (
    report.memberId !== actor.id &&
    !(await canManageActivity(c.env, actor, report.activityId, report.year))
  )
    return apiError(c, errors.viewForbidden)
  const events = await c.env.shift_app
    .prepare(
      `SELECT e.id, m.display_name AS actor, e.action, e.details, e.created_at AS createdAt FROM report_events e JOIN app_users m ON m.id=e.actor_id WHERE e.report_id=? ORDER BY e.created_at,e.id`
    )
    .bind(report.id)
    .all<{
      id: string
      actor: string
      action: string
      details: string
      createdAt: number
    }>()
  return c.json({
    events: events.results.map((e) => ({
      ...e,
      createdAt: toIso(e.createdAt),
    })),
  })
})
reportsApp.patch("/:reportId", async (c) => {
  const input = v.safeParse(reportStateInputSchema, await readJson(c.req.raw))
  if (!input.success) return apiError(c, errors.invalidReport)
  const report = await c.env.shift_app
    .prepare(`${reportSelection} WHERE r.id = ?`)
    .bind(c.req.param("reportId"))
    .first<ReportRow>()
  if (!report) return apiError(c, errors.reportNotFound)
  const actor = c.get("member")
  const allowed =
    input.output.status === "withdrawn"
      ? actor.id === report.memberId
      : await canManageActivity(c.env, actor, report.activityId, report.year)
  if (!allowed) return apiError(c, errors.changeForbidden)
  if (report.status === "withdrawn") return apiError(c, errors.reportCancelled)
  const now = Math.max(Date.now(), report.updatedAt + 1)
  const [result] = await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(
        `UPDATE assignment_reports SET status=?, resolved_by=?, resolved_at=?, updated_at=? WHERE id=? AND updated_at=?`
      )
      .bind(
        input.output.status,
        input.output.status === "resolved" ? actor.id : null,
        input.output.status === "resolved" ? now : null,
        now,
        report.id,
        Date.parse(input.output.updatedAt)
      ),
    c.env.shift_app
      .prepare(
        `INSERT INTO report_events (id, report_id, actor_id, action, details, created_at) SELECT ?,?,?,?,?,? WHERE changes()>0`
      )
      .bind(
        crypto.randomUUID(),
        report.id,
        actor.id,
        input.output.status,
        JSON.stringify(input.output),
        now
      ),
  ])
  if (!result || result.meta.changes === 0)
    return apiError(c, errors.reportStale)
  const updated = await c.env.shift_app
    .prepare(`${reportSelection} WHERE r.id=?`)
    .bind(report.id)
    .first<ReportRow>()
  if (!updated) return apiError(c, errors.reportChanged)
  if (input.output.status === "withdrawn")
    c.executionCtx.waitUntil(notifyReport(c.env, updated))
  return c.json({ report: reportJson(updated) })
})
