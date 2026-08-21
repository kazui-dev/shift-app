import { Hono } from "hono"
import * as v from "valibot"

import {
  createOperatingYearInputSchema,
  updateOperatingYearInputSchema,
} from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  parseYear,
  readJson,
  requireSystemAdmin,
} from "../../lib/http"

type YearRow = {
  year: number
  status: "draft" | "active" | "archived"
}

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearLifecycleApp = new Hono<ApiEnv>()

yearLifecycleApp.get("/", async (c) => {
  const member = c.get("member")
  const result = await c.env.shift_app
    .prepare(
      `SELECT operating_year.year, operating_year.status,
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
                  AND permission.permission = 'shift.manage'
              ) THEN 1 ELSE 0 END AS canManage
       FROM operating_years operating_year
       WHERE ? = 'system_admin' OR EXISTS (
         SELECT 1 FROM year_memberships year_membership
         WHERE year_membership.year = operating_year.year
           AND year_membership.member_id = ?
           AND year_membership.status = 'active'
       )
       ORDER BY year DESC`
    )
    .bind(member.accessLevel, member.id, member.accessLevel, member.id)
    .all<YearRow & { canManage: number }>()
  return c.json({
    years: result.results.map((year) => ({
      ...year,
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
    return apiError(
      c,
      422,
      "INVALID_YEAR",
      parsed.issues[0]?.message ?? "Invalid year"
    )
  }

  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT OR IGNORE INTO operating_years
        (year, status, created_at, updated_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(parsed.output.year, parsed.output.status, now, now)
    .run()

  if (result.meta.changes !== 1) {
    return apiError(c, 409, "YEAR_EXISTS", "Operating year already exists")
  }
  return c.json({ year: parsed.output }, 201)
})

yearLifecycleApp.patch("/:year", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied

  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const input = v.safeParse(
    updateOperatingYearInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_YEAR",
      input.issues[0]?.message ?? "Invalid year"
    )
  }

  const result = await c.env.shift_app
    .prepare(
      `UPDATE operating_years
       SET status = ?, updated_at = ?
       WHERE year = ?`
    )
    .bind(input.output.status, Date.now(), year)
    .run()
  if (result.meta.changes !== 1) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  return c.json({ year: { year, status: input.output.status } })
})
