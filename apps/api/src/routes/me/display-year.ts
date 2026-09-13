import { Hono } from "hono"
import * as v from "valibot"
import { displayYearInputSchema } from "@workspace/shared/shifts"
import { apiError, errors } from "../../lib/errors"
import { type ApiEnv, readJson } from "../../lib/http"
import { readDisplayYear } from "../../services/display-year"

export const displayYearApp = new Hono<ApiEnv>()
displayYearApp.get("/", async (c) =>
  c.json(await readDisplayYear(c.env.shift_app, c.get("member")))
)
displayYearApp.put("/", async (c) => {
  const input = v.safeParse(displayYearInputSchema, await readJson(c.req.raw))
  if (!input.success) return apiError(c, errors.invalidYear)
  const member = c.get("member")
  const result = await c.env.shift_app
    .prepare(`INSERT INTO user_preferences (member_id, selected_year)
    SELECT ?, CASE WHEN ? = (SELECT default_year FROM year_settings WHERE id = 1) THEN NULL ELSE ? END
    WHERE EXISTS (SELECT 1 FROM year_memberships WHERE member_id = ? AND year = ? AND status = 'active')
    ON CONFLICT (member_id) DO UPDATE SET selected_year = excluded.selected_year`)
    .bind(
      member.id,
      input.output.year,
      input.output.year,
      member.id,
      input.output.year
    )
    .run()
  if (result.meta.changes === 0)
    return apiError(c, errors.yearMembershipRequired)
  return c.json(await readDisplayYear(c.env.shift_app, member))
})
