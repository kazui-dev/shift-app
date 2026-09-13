import { yearRoom, roomStatements } from "../../services/chat-creation"
import { Hono } from "hono"
import * as v from "valibot"

import { createOperatingYearInputSchema } from "@workspace/shared/shifts"

import { apiError, errors } from "../../lib/errors"
import { type ApiEnv, readJson, requireSystemAdmin } from "../../lib/http"

type YearRow = {
  year: number
  isDefault: number
}

export const yearLifecycleApp = new Hono<ApiEnv>()

yearLifecycleApp.get("/", async (c) => {
  const member = c.get("member")
  const result = await c.env.shift_app
    .prepare(
      `SELECT operating_year.year,
              CASE WHEN operating_year.year = (SELECT default_year FROM year_settings WHERE id = 1)
                THEN 1 ELSE 0 END AS isDefault,
              CASE WHEN ? = 'system_admin' OR EXISTS (
                SELECT 1
                FROM member_year_roles membership
                JOIN year_roles role ON role.id = membership.role_id
                JOIN year_memberships year_membership
                  ON year_membership.year = role.year
                 AND year_membership.member_id = membership.member_id
                 AND year_membership.status = 'active'
                JOIN year_role_permissions permission ON permission.role_id = role.id
                WHERE membership.member_id = ?
                  AND role.year = operating_year.year
                  AND permission.permission IN ('shift.create', 'shift.manage', 'member.manage', 'role.manage')
              ) OR EXISTS (SELECT 1 FROM activity_effective_responsibles ar JOIN activities a ON a.id=ar.activity_id WHERE a.year=operating_year.year AND ar.member_id=?) THEN 1 ELSE 0 END AS canManage
       FROM operating_years operating_year
       WHERE ? = 'system_admin' OR EXISTS (
         SELECT 1 FROM year_memberships year_membership
         WHERE year_membership.year = operating_year.year
           AND year_membership.member_id = ?
           AND year_membership.status = 'active'
       )
       ORDER BY year DESC`
    )
    .bind(
      member.accessLevel,
      member.id,
      member.id,
      member.accessLevel,
      member.id
    )
    .all<YearRow & { canManage: number }>()
  return c.json({
    years: result.results.map((year) => ({
      ...year,
      isDefault: year.isDefault === 1,
      canManage: year.canManage === 1,
    })),
  })
})

yearLifecycleApp.post("/", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied

  const parsed = v.safeParse(
    createOperatingYearInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(c, errors.invalidYear, parsed.issues[0]?.message)
  }

  const now = Date.now()
  let result: D1Result
  try {
    const results = await c.env.shift_app.batch([
      c.env.shift_app
        .prepare(
          "INSERT INTO operating_years(year,created_at,updated_at) VALUES(?,?,?)"
        )
        .bind(parsed.output.year, now, now),
      ...roomStatements(
        c.env.shift_app,
        yearRoom(parsed.output.year, c.get("member").id),
        now
      ),
    ])
    if (!results[0]) throw new Error("Year creation failed")
    result = results[0]
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: operating_years.year")
    )
      return apiError(c, errors.yearExists)
    throw error
  }
  if (!result.success) throw new Error("Year creation failed")
  const settings = await c.env.shift_app
    .prepare(
      "SELECT default_year AS defaultYear FROM year_settings WHERE id = 1"
    )
    .first<{ defaultYear: number }>()
  return c.json(
    {
      year: {
        year: parsed.output.year,
        isDefault: settings?.defaultYear === parsed.output.year,
      },
    },
    201
  )
})
