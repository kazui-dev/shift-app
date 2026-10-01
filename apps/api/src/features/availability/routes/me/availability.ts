import { submissionStatements } from "../../services/save-submission"
import { Hono } from "hono"
import * as v from "valibot"
import { formAnswersInputSchema } from "@workspace/shared/availability"
import { apiError, errors } from "../../../../lib/errors"
import { type ApiEnv, parseYear, readJson } from "../../../../lib/http"
import { hasActiveYearMembership } from "../../../../auth/authorization/membership"
import { readAvailabilityForm } from "../../services/availability-form"
import { validateFormAnswers } from "../../domain/availability-form"
import { broadcastChange } from "../../../live/services/live-events"
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
  if (
    input.output.submit &&
    input.output.revision !== undefined &&
    input.output.revision !== form.revision
  )
    return apiError(c, errors.availabilitySubmissionChanged)
  // Legacy screens cannot prove which answer they opened after someone else edited it.
  if (input.output.submit && input.output.revision === undefined) {
    const edited = await db
      .prepare(`SELECT 1 FROM availability_submission_changes change
      JOIN availability_submissions submission ON submission.id=change.submission_id
      WHERE submission.year=? AND submission.member_id=? AND change.changed_by<>? LIMIT 1`)
      .bind(year, memberId, memberId)
      .first()
    if (edited) return apiError(c, errors.availabilitySubmissionChanged)
  }
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
      .prepare(`INSERT INTO availability_drafts (year,member_id,revision,answers,updated_at) VALUES (?,?,?,CASE WHEN ?=0 OR (
    (SELECT COUNT(*) FROM availability_dates WHERE year=? AND deleted=0 AND accepting=1)=? AND NOT EXISTS (
      SELECT 1 FROM availability_dates d WHERE d.year=? AND d.deleted=0 AND d.accepting=1 AND NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.date')=d.date AND json_extract(j.value,'$.version')=d.version)
    )) THEN ? ELSE NULL END,?) ON CONFLICT(year,member_id) DO UPDATE SET answers=excluded.answers,updated_at=excluded.updated_at,revision=excluded.revision`)
      .bind(
        year,
        memberId,
        input.output.revision ?? form.draftRevision ?? 0,
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
    statements.push(
      ...(await submissionStatements(
        db,
        year,
        memberId,
        form,
        input.output.answers,
        c.get("member"),
        now
      ))
    )
    statements.push(
      db
        .prepare(
          "UPDATE availability_drafts SET revision=? WHERE year=? AND member_id=?"
        )
        .bind(form.revision + 1, year, memberId)
    )
  }

  try {
    await db.batch(statements)
  } catch (error) {
    if (error instanceof Error && error.message.includes("AVAILABILITY_STALE"))
      return apiError(c, errors.availabilitySubmissionChanged)
    if (
      error instanceof Error &&
      (error.message.includes("availability_drafts.answers") ||
        error.message.includes("availability_day_answers.date_version"))
    )
      return apiError(c, errors.availabilityFormChanged)
    throw error
  }
  // Drafts save as members type; only a submission changes the progress others see.
  if (input.output.submit)
    c.executionCtx.waitUntil(
      broadcastChange(c.env, { type: "availability_submitted", year })
    )
  return c.json(await readAvailabilityForm(db, year, memberId))
})
