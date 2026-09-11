import { Hono } from "hono"
import * as v from "valibot"

import { replaceYearSettingsInputSchema } from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  readJson,
  requireSystemAdmin,
} from "../lib/http"

export const yearSettingsApp = new Hono<ApiEnv>()

yearSettingsApp.put("/", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied

  const input = v.safeParse(
    replaceYearSettingsInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(c, 422, "INVALID_YEAR", "A default year is required")
  }

  const result = await c.env.shift_app
    .prepare(`UPDATE year_settings SET default_year = ?
      WHERE id = 1 AND EXISTS (SELECT 1 FROM operating_years WHERE year = ?)`)
    .bind(input.output.defaultYear, input.output.defaultYear)
    .run()
  if (result.meta.changes !== 1) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  return c.json({ defaultYear: input.output.defaultYear })
})
