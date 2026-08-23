import { Hono } from "hono"
import * as v from "valibot"

import { replaceAvailabilityInputSchema } from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  hasActiveYearMembership,
  parseYear,
  readJson,
  toIso,
} from "../../lib/http"

type AvailabilityRow = {
  id: string
  status: "draft" | "submitted"
  submittedAt: number | null
  updatedAt: number
}

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const meAvailabilityApp = new Hono<ApiEnv>()

meAvailabilityApp.get("/:year", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const member = c.get("member")
  if (!(await hasActiveYearMembership(c.env, member.id, year))) {
    return apiError(
      c,
      403,
      "YEAR_MEMBERSHIP_REQUIRED",
      "Active year membership is required"
    )
  }
  const availabilityDates = await c.env.shift_app
    .prepare(`SELECT date FROM availability_dates WHERE year = ? ORDER BY date`)
    .bind(year)
    .all<{ date: string }>()
  const dates = availabilityDates.results.map((item) => item.date)
  const submission = await c.env.shift_app
    .prepare(
      `SELECT id, status, submitted_at AS submittedAt, updated_at AS updatedAt
       FROM availability_submissions WHERE year = ? AND member_id = ?`
    )
    .bind(year, member.id)
    .first<AvailabilityRow>()
  if (!submission) {
    return c.json({
      availability: {
        year,
        status: "draft" as const,
        submittedAt: null,
        dates,
        windows: [],
      },
    })
  }

  const windows = await c.env.shift_app
    .prepare(
      `SELECT window.id, availability_date.date,
              window.starts_at AS startsAt, window.ends_at AS endsAt
       FROM availability_windows window
       JOIN availability_dates availability_date
         ON availability_date.id = window.availability_date_id
       WHERE window.submission_id = ? ORDER BY window.starts_at`
    )
    .bind(submission.id)
    .all<{ id: string; date: string; startsAt: number; endsAt: number }>()
  return c.json({
    availability: {
      year,
      status: submission.status,
      submittedAt: submission.submittedAt
        ? toIso(submission.submittedAt)
        : null,
      updatedAt: toIso(submission.updatedAt),
      dates,
      windows: windows.results.map((window) => ({
        id: window.id,
        date: window.date,
        startsAt: toIso(window.startsAt),
        endsAt: toIso(window.endsAt),
      })),
    },
  })
})

meAvailabilityApp.put("/:year", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const parsed = v.safeParse(
    replaceAvailabilityInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_AVAILABILITY",
      parsed.issues[0]?.message ?? "Invalid availability"
    )
  }
  const member = c.get("member")
  if (!(await hasActiveYearMembership(c.env, member.id, year))) {
    return apiError(
      c,
      403,
      "YEAR_MEMBERSHIP_REQUIRED",
      "Active year membership is required"
    )
  }
  const availabilityDates = await c.env.shift_app
    .prepare(`SELECT id, date FROM availability_dates WHERE year = ?`)
    .bind(year)
    .all<{ id: string; date: string }>()
  const dateIds = new Map(
    availabilityDates.results.map((item) => [item.date, item.id])
  )
  if (parsed.output.windows.some((window) => !dateIds.has(window.date))) {
    return apiError(
      c,
      422,
      "AVAILABILITY_DATE_NOT_ALLOWED",
      "Availability can only be entered for configured dates"
    )
  }
  const submissionId = crypto.randomUUID()
  const now = Date.now()
  const submittedAt = parsed.output.status === "submitted" ? now : null
  const statements = [
    c.env.shift_app
      .prepare(
        `INSERT INTO availability_submissions
          (id, year, member_id, status, submitted_at, created_at, updated_at)
         SELECT ?, operating_year.year, ?, ?, ?, ?, ?
         FROM operating_years operating_year
         JOIN year_memberships year_membership
           ON year_membership.year = operating_year.year
          AND year_membership.member_id = ?
          AND year_membership.status = 'active'
         WHERE operating_year.year = ? AND operating_year.status = 'active'
         ON CONFLICT(year, member_id) DO UPDATE SET
           status = excluded.status,
           submitted_at = excluded.submitted_at,
           updated_at = excluded.updated_at`
      )
      .bind(
        submissionId,
        member.id,
        parsed.output.status,
        submittedAt,
        now,
        now,
        member.id,
        year
      ),
    c.env.shift_app
      .prepare(
        `DELETE FROM availability_windows
         WHERE submission_id = (
           SELECT submission.id FROM availability_submissions submission
           JOIN operating_years operating_year ON operating_year.year = submission.year
           JOIN year_memberships year_membership
             ON year_membership.year = submission.year
            AND year_membership.member_id = submission.member_id
            AND year_membership.status = 'active'
           WHERE submission.year = ? AND submission.member_id = ? AND operating_year.status = 'active'
         )`
      )
      .bind(year, member.id),
    ...parsed.output.windows.map((window) =>
      c.env.shift_app
        .prepare(
          `INSERT INTO availability_windows
            (id, submission_id, availability_date_id, starts_at, ends_at, created_at)
           SELECT ?, submission.id, ?, ?, ?, ?
           FROM availability_submissions submission
           JOIN operating_years operating_year ON operating_year.year = submission.year
           JOIN year_memberships year_membership
             ON year_membership.year = submission.year
            AND year_membership.member_id = submission.member_id
            AND year_membership.status = 'active'
           WHERE submission.year = ? AND submission.member_id = ? AND operating_year.status = 'active'`
        )
        .bind(
          crypto.randomUUID(),
          dateIds.get(window.date),
          Date.parse(window.startsAt),
          Date.parse(window.endsAt),
          now,
          year,
          member.id
        )
    ),
  ]
  const results = await c.env.shift_app.batch(statements)
  if (results[0]?.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "YEAR_NOT_ACTIVE",
      "Availability can only be edited for an active year"
    )
  }
  return c.json({
    availability: {
      year,
      status: parsed.output.status,
      submittedAt: submittedAt ? toIso(submittedAt) : null,
      dates: availabilityDates.results.map((item) => item.date).toSorted(),
      windows: parsed.output.windows,
    },
  })
})
