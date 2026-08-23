import { Hono } from "hono"
import * as v from "valibot"

import {
  createAvailabilityDateInputSchema,
  dateOnlySchema,
} from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  parseYear,
  readJson,
} from "../../lib/http"

export const availabilityDatesApp = new Hono<ApiEnv>()

availabilityDatesApp.get("/:year/availability-dates", async (c) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canManageShifts(c.env, c.get("member"), year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }

  const dates = await c.env.shift_app
    .prepare(`SELECT date FROM availability_dates WHERE year = ? ORDER BY date`)
    .bind(year)
    .all<{ date: string }>()

  return c.json({ dates: dates.results.map((item) => item.date) })
})

availabilityDatesApp.post("/:year/availability-dates", async (c) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canManageShifts(c.env, c.get("member"), year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }

  const input = v.safeParse(
    createAvailabilityDateInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_AVAILABILITY_DATE",
      input.issues[0]?.message ?? "Invalid availability date"
    )
  }

  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT OR IGNORE INTO availability_dates
        (id, year, date, created_at, updated_at)
       SELECT ?, year, ?, ?, ? FROM operating_years WHERE year = ?`
    )
    .bind(crypto.randomUUID(), input.output.date, now, now, year)
    .run()
  if (result.meta.changes === 1) {
    return c.json({ date: input.output.date }, 201)
  }

  const existing = await c.env.shift_app
    .prepare(
      `SELECT 1 AS found FROM availability_dates WHERE year = ? AND date = ?`
    )
    .bind(year, input.output.date)
    .first<{ found: number }>()
  return existing
    ? apiError(
        c,
        409,
        "AVAILABILITY_DATE_EXISTS",
        "Availability date already exists"
      )
    : apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
})

availabilityDatesApp.delete("/:year/availability-dates/:date", async (c) => {
  const year = parseYear(c.req.param("year"))
  const date = v.safeParse(dateOnlySchema, c.req.param("date"))
  if (year === null || !date.success) {
    return apiError(c, 404, "AVAILABILITY_DATE_NOT_FOUND", "Date not found")
  }
  if (!(await canManageShifts(c.env, c.get("member"), year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }

  const result = await c.env.shift_app
    .prepare(`DELETE FROM availability_dates WHERE year = ? AND date = ?`)
    .bind(year, date.output)
    .run()
  if (result.meta.changes !== 1) {
    return apiError(c, 404, "AVAILABILITY_DATE_NOT_FOUND", "Date not found")
  }
  return c.body(null, 204)
})
