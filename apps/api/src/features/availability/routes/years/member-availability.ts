import { Hono } from "hono"
import * as v from "valibot"
import { managedAnswersInputSchema } from "@workspace/shared/availability"
import { canManageShifts } from "../../../../auth/authorization/membership"
import { apiError, errors } from "../../../../lib/errors"
import { type ApiEnv, parseYear, readJson } from "../../../../lib/http"
import { planningMembers } from "../../../directory/services/directory-work"
import { broadcastChange } from "../../../live/services/live-events"
import { validateFormAnswers } from "../../domain/availability-form"
import { readAvailabilityForm } from "../../services/availability-form"
import { submissionStatements } from "../../services/save-submission"

export const memberAvailabilityApp = new Hono<ApiEnv>()
memberAvailabilityApp.on(
  ["GET", "PATCH"],
  "/:year/availability-submissions/:memberId",
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
    const db = c.env.shift_app
    const target = await db
      .prepare(
        `SELECT user_id AS userId FROM ${planningMembers} WHERE id=? AND year=?`
      )
      .bind(memberId.output, year)
      .first<{ userId: string | null }>()
    if (!target) return apiError(c, errors.memberNotFound)
    const directory = target.userId === null
    const form = await readAvailabilityForm(
      db,
      year,
      memberId.output,
      directory
    )
    if (c.req.method === "GET")
      return c.json({ ...form, answers: form.submitted, draftRevision: null })
    const input = v.safeParse(
      managedAnswersInputSchema,
      await readJson(c.req.raw)
    )
    if (!input.success) return apiError(c, errors.invalidAnswers)
    if (input.output.revision !== form.revision)
      return apiError(c, errors.availabilitySubmissionChanged)
    if (
      input.output.answers.some(
        (answer) => !form.dates.some((date) => date.date === answer.date)
      )
    )
      return apiError(c, errors.invalidAnswers)
    const validationError = validateFormAnswers(
      form.dates
        .filter((date) =>
          input.output.answers.some((answer) => answer.date === date.date)
        )
        .map((date) => ({ ...date, accepting: true })),
      input.output.answers,
      true
    )
    if (validationError)
      return apiError(c, errors.invalidAnswers, validationError)
    // Omitted days remain unanswered or keep their current answer.
    if (input.output.answers.length === 0)
      return c.json({ ...form, answers: form.submitted, draftRevision: null })
    try {
      await db.batch(
        await submissionStatements(
          db,
          year,
          memberId.output,
          form,
          input.output.answers,
          c.get("member"),
          Date.now(),
          true,
          directory
        )
      )
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("AVAILABILITY_STALE") ||
          (directory &&
            error.message.includes("FOREIGN KEY constraint failed")))
      )
        return apiError(c, errors.availabilitySubmissionChanged)
      if (
        error instanceof Error &&
        error.message.includes("availability_day_answers.date_version")
      )
        return apiError(c, errors.availabilityFormChanged)
      throw error
    }
    c.executionCtx.waitUntil(
      broadcastChange(c.env, { type: "availability_submitted", year })
    )
    const result = await readAvailabilityForm(
      db,
      year,
      memberId.output,
      directory
    )
    return c.json({ ...result, answers: result.submitted, draftRevision: null })
  }
)
