import { Hono } from "hono"
import * as v from "valibot"

import { createActivityInputSchema } from "@workspace/shared/shifts"

import {
  serializeActivity,
  type ActivityRow,
} from "../../domain/year-projections"
import {
  apiError,
  type ApiEnv,
  canAccessYear,
  canManageShifts,
  parseYear,
  readJson,
} from "../../lib/http"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearActivitiesApp = new Hono<ApiEnv>()

yearActivitiesApp.get("/:year/activities", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canAccessYear(c.env, c.get("member"), year))) {
    return apiError(c, 403, "FORBIDDEN", "Active year membership is required")
  }
  const result = await c.env.shift_app
    .prepare(
      `SELECT
         activity.id,
         activity.year,
         activity.name,
         activity.place,
         activity.activity_type AS activityType,
         activity.starts_at AS startsAt,
         activity.ends_at AS endsAt,
         activity.color,
         activity.notes,
         (SELECT COUNT(*) FROM shift_assignments assignment
          WHERE assignment.activity_id = activity.id AND assignment.status = 'active') AS assignmentCount
       FROM activities activity
       WHERE activity.year = ?
       ORDER BY activity.starts_at, lower(activity.name)`
    )
    .bind(year)
    .all<ActivityRow>()
  return c.json({ activities: result.results.map(serializeActivity) })
})

yearActivitiesApp.post("/:year/activities", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const member = c.get("member")
  if (!(await canManageShifts(c.env, member, year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  const parsed = v.safeParse(
    createActivityInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_ACTIVITY",
      parsed.issues[0]?.message ?? "Invalid activity"
    )
  }

  const id = crypto.randomUUID()
  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT INTO activities
        (id, year, name, place, activity_type, starts_at, ends_at, color, notes,
         created_by, updated_by, created_at, updated_at)
       SELECT ?, year, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM operating_years WHERE year = ? AND status <> 'archived'`
    )
    .bind(
      id,
      parsed.output.name,
      parsed.output.place,
      parsed.output.activityType,
      Date.parse(parsed.output.startsAt),
      Date.parse(parsed.output.endsAt),
      parsed.output.color,
      parsed.output.notes,
      member.id,
      member.id,
      now,
      now,
      year
    )
    .run()
  if (result.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "YEAR_NOT_EDITABLE",
      "Operating year is archived or missing"
    )
  }

  return c.json(
    {
      activity: serializeActivity({
        id,
        year,
        ...parsed.output,
        startsAt: Date.parse(parsed.output.startsAt),
        endsAt: Date.parse(parsed.output.endsAt),
        assignmentCount: 0,
      }),
    },
    201
  )
})
