import { Hono } from "hono"
import * as v from "valibot"
import { formAnswersInputSchema } from "@workspace/shared/availability"
import { apiError, errors } from "../../lib/errors"
import {
  type ApiEnv,
  hasActiveYearMembership,
  parseYear,
  readJson,
} from "../../lib/http"
import { readAvailabilityForm } from "../../services/availability-form"
import { validateFormAnswers } from "../../domain/availability-form"
export const meAvailabilityApp = new Hono<ApiEnv>()
meAvailabilityApp.use("/:year", async (c, next) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) return apiError(c, errors.invalidYear)
  if (!(await hasActiveYearMembership(c.env, c.get("member").id, year)))
    return apiError(c, errors.yearMembershipRequired)
  return next()
})
meAvailabilityApp.get("/:year", async (c) =>
  c.json(
    await readAvailabilityForm(
      c.env.shift_app,
      Number(c.req.param("year")),
      c.get("member").id
    )
  )
)
meAvailabilityApp.put("/:year", async (c) => {
  const input = v.safeParse(formAnswersInputSchema, await readJson(c.req.raw))
  if (!input.success) return apiError(c, errors.invalidAnswers)
  const year = Number(c.req.param("year")),
    memberId = c.get("member").id,
    db = c.env.shift_app
  const form = await readAvailabilityForm(db, year, memberId)
  const validationError = validateFormAnswers(
    form.dates,
    input.output.answers,
    input.output.submit
  )
  if (validationError)
    return apiError(c, errors.invalidAnswers, validationError)
  const now = Date.now(),
    json = JSON.stringify(input.output.answers)
  const statements: D1PreparedStatement[] = []
  const open = form.dates.filter((date) => date.accepting)
  statements.push(
    db
      .prepare(`INSERT INTO availability_drafts (year,member_id,answers,updated_at) VALUES (?,?,CASE WHEN ?=0 OR (
    (SELECT COUNT(*) FROM availability_dates WHERE year=? AND deleted=0 AND accepting=1)=? AND NOT EXISTS (
      SELECT 1 FROM availability_dates d WHERE d.year=? AND d.deleted=0 AND d.accepting=1 AND NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.date')=d.date AND json_extract(j.value,'$.version')=d.version)
    )) THEN ? ELSE NULL END,?) ON CONFLICT(year,member_id) DO UPDATE SET answers=excluded.answers,updated_at=excluded.updated_at`)
      .bind(
        year,
        memberId,
        input.output.submit ? 1 : 0,
        year,
        open.length,
        year,
        json,
        json,
        now
      )
  )
  if (input.output.submit) {
    const old = await db
      .prepare(
        "SELECT id FROM availability_submissions WHERE year=? AND member_id=?"
      )
      .bind(year, memberId)
      .first<{ id: string }>()
    const id = old?.id ?? crypto.randomUUID()
    statements.push(
      db
        .prepare(
          "INSERT INTO availability_submissions (id,year,member_id,status,submitted_at,created_at,updated_at) VALUES (?,?,?,'submitted',?,?,?) ON CONFLICT(year,member_id) DO UPDATE SET status='submitted',submitted_at=excluded.submitted_at,updated_at=excluded.updated_at"
        )
        .bind(id, year, memberId, now, now, now)
    )
    for (const date of open) {
      const answer = input.output.answers.find(
        (item) => item.date === date.date
      )
      if (!answer) continue
      statements.push(
        db
          .prepare(
            "DELETE FROM availability_windows WHERE submission_id=? AND availability_date_id=?"
          )
          .bind(id, date.id),
        db
          .prepare(
            "INSERT INTO availability_day_answers (submission_id,date_id,date_version,choice) VALUES (?,?,?,?) ON CONFLICT(submission_id,date_id) DO UPDATE SET date_version=excluded.date_version,choice=excluded.choice"
          )
          .bind(id, date.id, date.version, answer.choice)
      )
      const times =
        answer.choice === "all"
          ? [{ from: date.startsMinute, to: date.endsMinute }]
          : answer.choice === "times"
            ? answer.times
            : []
      const base = Date.parse(`${date.date}T00:00:00+09:00`)
      for (const time of times)
        statements.push(
          db
            .prepare(
              "INSERT INTO availability_windows (id,submission_id,availability_date_id,starts_at,ends_at,created_at) VALUES (?,?,?,?,?,?)"
            )
            .bind(
              crypto.randomUUID(),
              id,
              date.id,
              base + time.from * 60000,
              base + time.to * 60000,
              now
            )
        )
    }
  }
  try {
    await db.batch(statements)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("availability_drafts.answers")
    )
      return apiError(c, errors.availabilityFormChanged)
    throw error
  }
  return c.json(await readAvailabilityForm(db, year, memberId))
})
