import {
  planningMembers,
  planningIdentities,
  planningSubmissions,
  planningAnswers,
  planningWindows,
} from "../../../directory/services/directory-work"
import * as v from "valibot"
import { availabilityHistoryResponseSchema } from "@workspace/shared/shifts"
import { sendMemberNotification } from "../../../notifications/services/push"
import { apiError, errors } from "../../../../lib/errors"
import { Hono } from "hono"

import {
  groupAvailabilitySubmissions,
  type AvailabilityManagerRow,
} from "../../../years/domain/year-projections"
import { type ApiEnv, parseYear, readJson, toIso } from "../../../../lib/http"
import { canManageShifts } from "../../../../auth/authorization/membership"

export const availabilitySubmissionsApp = new Hono<ApiEnv>()

availabilitySubmissionsApp.get("/:year/availability-submissions", async (c) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) {
    return apiError(c, errors.yearNotFound)
  }
  if (!(await canManageShifts(c.env, c.get("member"), year))) {
    return apiError(c, errors.shiftManagementRequired)
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
       FROM ${planningSubmissions} submission
       JOIN ${planningIdentities} member ON member.id = submission.member_id
       LEFT JOIN ${planningWindows} window ON window.submission_id = submission.id
       LEFT JOIN availability_dates availability_date
         ON availability_date.id = window.availability_date_id
       WHERE submission.year = ? AND submission.status='submitted'
       ORDER BY lower(member.display_name), window.starts_at`
    )
    .bind(year)
    .all<AvailabilityManagerRow>()

  const progress = await readProgress(c.env.shift_app, year)
  return c.json({
    progress: progress.map((item) => ({
      ...item,
      complete: !!item.complete,
      hasHistory: !!item.hasHistory,
    })),
    submissions: groupAvailabilitySubmissions(rows.results),
  })
})

availabilitySubmissionsApp.get(
  "/:year/availability-submissions/:memberId/history",
  async (c) => {
    const year = parseYear(c.req.param("year"))
    if (year === null) return apiError(c, errors.yearNotFound)
    if (!(await canManageShifts(c.env, c.get("member"), year)))
      return apiError(c, errors.shiftManagementRequired)
    const memberId = v.safeParse(
      v.pipe(v.string(), v.uuid()),
      c.req.param("memberId")
    )
    if (!memberId.success) return apiError(c, errors.memberNotFound)
    const rows = await c.env.shift_app
      .prepare(
        `SELECT change.id,change.date,change.changed_at AS changedAt,
          change.before_choice AS beforeChoice,change.before_times AS beforeTimes,
          change.after_choice AS afterChoice,change.after_times AS afterTimes
        FROM availability_submission_changes change
        JOIN availability_submissions submission ON submission.id=change.submission_id
        WHERE submission.year=? AND submission.member_id=?
        ORDER BY change.changed_at DESC,change.date,change.id`
      )
      .bind(year, memberId.output)
      .all<{
        id: string
        date: string
        changedAt: number
        beforeChoice: "all" | "times" | "no" | "unanswered"
        beforeTimes: string
        afterChoice: "all" | "times" | "no"
        afterTimes: string
      }>()
    return c.json(
      v.parse(availabilityHistoryResponseSchema, {
        changes: rows.results.map((row) => ({
          id: row.id,
          date: row.date,
          changedAt: toIso(row.changedAt),
          before: {
            choice: row.beforeChoice,
            times: JSON.parse(row.beforeTimes),
          },
          after: { choice: row.afterChoice, times: JSON.parse(row.afterTimes) },
        })),
      })
    )
  }
)

async function readProgress(db: D1Database, year: number) {
  const result = await db
    .prepare(`SELECT m.id AS memberId,m.display_name AS displayName,m.student_id AS studentId,identity.image AS image,
    EXISTS(SELECT 1 FROM availability_submission_changes change
      JOIN availability_submissions submission ON submission.id=change.submission_id
      WHERE submission.year=m.year AND submission.member_id=m.id) AS hasHistory,
    NOT EXISTS(SELECT 1 FROM availability_dates d WHERE d.year=m.year AND d.deleted=0 AND d.accepting=1 AND NOT EXISTS(
      SELECT 1 FROM ${planningSubmissions} s JOIN ${planningAnswers} answer ON answer.submission_id=s.id
      WHERE s.year=m.year AND s.member_id=m.id AND s.status='submitted' AND answer.date_id=d.id AND answer.date_version=d.version)) AS complete
    FROM ${planningMembers} m
    LEFT JOIN user identity ON identity.id=m.user_id WHERE m.year=? ORDER BY m.student_id`)
    .bind(year)
    .all<{
      memberId: string
      displayName: string
      studentId: string
      image: string | null
      complete: number
      hasHistory: number
    }>()
  return result.results
}
availabilitySubmissionsApp.post(
  "/:year/availability-notifications",
  async (c) => {
    const year = parseYear(c.req.param("year"))
    const input = v.safeParse(
      v.object({ scope: v.picklist(["all", "incomplete"]) }),
      await readJson(c.req.raw)
    )
    if (year === null || !input.success)
      return apiError(c, errors.invalidNotificationTarget)
    if (!(await canManageShifts(c.env, c.get("member"), year)))
      return apiError(c, errors.shiftManagementRequired)
    const open = await c.env.shift_app
      .prepare(
        "SELECT 1 FROM availability_dates WHERE year=? AND accepting=1 AND deleted=0 LIMIT 1"
      )
      .bind(year)
      .first()
    if (!open) return apiError(c, errors.availabilityFormClosed)
    const recipients = (await readProgress(c.env.shift_app, year)).filter(
      (item) => input.output.scope === "all" || !item.complete
    )
    const sent = await Promise.all(
      recipients.map((item) =>
        sendMemberNotification(
          c.env,
          item.memberId,
          "シフト希望を受け付けています",
          `${year}のシフト希望を確認してください。`,
          "/calendar/availability",
          `availability-${year}`
        )
      )
    )
    if (sent.some((result) => !result))
      return apiError(c, errors.notificationRetry)
    return c.body(null, 204)
  }
)
