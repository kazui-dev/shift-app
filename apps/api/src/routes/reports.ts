import { Hono } from "hono"
import * as v from "valibot"
import { reportStateInputSchema } from "@workspace/shared/shifts"
import { apiError, type ApiEnv, readJson, toIso } from "../lib/http"
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
  if (!report)
    return apiError(c, 404, "REPORT_NOT_FOUND", "連絡が見つかりません")
  const actor = c.get("member")
  if (
    report.memberId !== actor.id &&
    !(await canManageActivity(c.env, actor, report.activityId, report.year))
  )
    return apiError(c, 403, "FORBIDDEN", "閲覧権限がありません")
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
  if (!input.success)
    return apiError(c, 422, "INVALID_REPORT", "連絡内容を確認してください")
  const report = await c.env.shift_app
    .prepare(`${reportSelection} WHERE r.id = ?`)
    .bind(c.req.param("reportId"))
    .first<ReportRow>()
  if (!report)
    return apiError(c, 404, "REPORT_NOT_FOUND", "連絡が見つかりません")
  const actor = c.get("member")
  const allowed =
    input.output.status === "withdrawn"
      ? actor.id === report.memberId
      : await canManageActivity(c.env, actor, report.activityId, report.year)
  if (!allowed) return apiError(c, 403, "FORBIDDEN", "変更権限がありません")
  if (report.status === "withdrawn")
    return apiError(c, 409, "REPORT_CHANGED", "この連絡は取り消されています")
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
    return apiError(
      c,
      409,
      "REPORT_CHANGED",
      "連絡が更新されています。内容を読み直してください"
    )
  const updated = await c.env.shift_app
    .prepare(`${reportSelection} WHERE r.id=?`)
    .bind(report.id)
    .first<ReportRow>()
  if (!updated)
    return apiError(c, 409, "REPORT_CHANGED", "連絡が変更されました")
  if (input.output.status === "withdrawn")
    c.executionCtx.waitUntil(notifyReport(c.env, updated))
  return c.json({ report: reportJson(updated) })
})
