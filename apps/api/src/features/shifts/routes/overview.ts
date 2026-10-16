import { Hono } from "hono"
import * as v from "valibot"
import { dateOnlySchema } from "@workspace/shared/shifts"
import {
  canAccessYear,
  canManageShifts,
} from "../../../auth/authorization/membership"
import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, parseYear } from "../../../lib/http"
import { readShiftOverview } from "../services/shift-overview"

export const shiftOverviewApp = new Hono<ApiEnv>()
shiftOverviewApp.get("/:year/shift-overview", async (c) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) return apiError(c, errors.yearNotFound)
  const date = v.safeParse(dateOnlySchema, c.req.query("date"))
  if (!date.success) return apiError(c, errors.invalidShift)
  const actor = c.get("member")
  if (!(await canAccessYear(c.env, actor, year)))
    return apiError(c, errors.yearMembershipRequired)
  const canEdit = await canManageShifts(c.env, actor, year)
  if (!canEdit) {
    const responsible = await c.env.shift_app
      .prepare(
        `SELECT 1 FROM activity_effective_responsibles r JOIN activities a ON a.id=r.activity_id WHERE a.year=? AND r.member_id=? LIMIT 1`
      )
      .bind(year, actor.id)
      .first()
    if (!responsible) return apiError(c, errors.shiftResponsibilityRequired)
  }
  return c.json(
    await readShiftOverview(
      c.env.shift_app,
      year,
      date.output,
      actor.id,
      canEdit
    )
  )
})
