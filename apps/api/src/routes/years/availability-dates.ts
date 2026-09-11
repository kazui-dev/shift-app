import { Hono } from "hono"
import * as v from "valibot"
import { formDateInputSchema } from "@workspace/shared/availability"
import {
  apiError,
  type ApiEnv,
  canManageShifts,
  parseYear,
  readJson,
} from "../../lib/http"
export const availabilityDatesApp = new Hono<ApiEnv>()
availabilityDatesApp.use("/:year/availability-dates/*", (c, next) =>
  authorize(c, next)
)
availabilityDatesApp.use("/:year/availability-dates", (c, next) =>
  authorize(c, next)
)
async function authorize(
  c: import("hono").Context<ApiEnv>,
  next: import("hono").Next
) {
  const year = parseYear(c.req.param("year") ?? "")
  if (year === null) return apiError(c, 422, "INVALID_YEAR", "Invalid year")
  if (!(await canManageShifts(c.env, c.get("member"), year)))
    return apiError(c, 403, "FORBIDDEN", "Shift management is required")
  return next()
}
availabilityDatesApp.get("/:year/availability-dates", async (c) => {
  const dates = await c.env.shift_app
    .prepare(
      "SELECT date,starts_minute AS startsMinute,ends_minute AS endsMinute,accepting,version FROM availability_dates WHERE year=? AND deleted=0 ORDER BY date"
    )
    .bind(Number(c.req.param("year")))
    .all<{
      date: string
      startsMinute: number
      endsMinute: number
      accepting: number
      version: number
    }>()
  return c.json({
    dates: dates.results.map((date) => ({
      ...date,
      accepting: date.accepting === 1,
    })),
  })
})
availabilityDatesApp.put("/:year/availability-dates/:date", async (c) => {
  const input = v.safeParse(formDateInputSchema, await readJson(c.req.raw))
  if (!input.success || input.output.date !== c.req.param("date"))
    return apiError(c, 422, "INVALID_DATE", "Invalid date settings")
  const date = input.output,
    now = Date.now()
  await c.env.shift_app
    .prepare(`INSERT INTO availability_dates (id,year,date,starts_minute,ends_minute,accepting,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(year,date) DO UPDATE SET starts_minute=excluded.starts_minute,ends_minute=excluded.ends_minute,accepting=excluded.accepting,deleted=0,updated_at=excluded.updated_at,
    version=CASE WHEN availability_dates.starts_minute<>excluded.starts_minute OR availability_dates.ends_minute<>excluded.ends_minute OR availability_dates.deleted=1 THEN availability_dates.version+1 ELSE availability_dates.version END`)
    .bind(
      crypto.randomUUID(),
      Number(c.req.param("year")),
      date.date,
      date.startsMinute,
      date.endsMinute,
      date.accepting ? 1 : 0,
      now,
      now
    )
    .run()
  return c.body(null, 204)
})
availabilityDatesApp.delete("/:year/availability-dates/:date", async (c) => {
  await c.env.shift_app
    .prepare(
      "UPDATE availability_dates SET deleted=1,accepting=0,updated_at=? WHERE year=? AND date=?"
    )
    .bind(Date.now(), Number(c.req.param("year")), c.req.param("date"))
    .run()
  return c.body(null, 204)
})
