import { Hono } from "hono"
import * as v from "valibot"

import { createYearRoleInputSchema } from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  canAccessYear,
  parseYear,
  readJson,
  requireSystemAdmin,
} from "../../lib/http"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearRolesApp = new Hono<ApiEnv>()

yearRolesApp.get("/:year/roles", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canAccessYear(c.env, c.get("member"), year))) {
    return apiError(c, 403, "FORBIDDEN", "Active year membership is required")
  }

  const roles = await c.env.shift_app
    .prepare(
      `SELECT
         role.id,
         role.name,
         role.color,
         GROUP_CONCAT(permission.permission) AS permissions,
         (SELECT COUNT(*) FROM member_year_roles membership
          JOIN year_memberships year_membership
            ON year_membership.member_id = membership.member_id
           AND year_membership.year = role.year
           AND year_membership.status = 'active'
          WHERE membership.role_id = role.id) AS memberCount
       FROM year_roles role
       LEFT JOIN year_role_permissions permission ON permission.role_id = role.id
       WHERE role.year = ?
       GROUP BY role.id
       ORDER BY lower(role.name)`
    )
    .bind(year)
    .all<{
      id: string
      name: string
      color: string
      permissions: string | null
      memberCount: number
    }>()

  return c.json({
    roles: roles.results.map((role) => ({
      ...role,
      year,
      permissions: role.permissions?.split(",") ?? [],
    })),
  })
})

yearRolesApp.post("/:year/roles", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const parsed = v.safeParse(
    createYearRoleInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_ROLE",
      parsed.issues[0]?.message ?? "Invalid role"
    )
  }

  const roleId = crypto.randomUUID()
  const now = Date.now()
  const statements = [
    c.env.shift_app
      .prepare(
        `INSERT OR IGNORE INTO year_roles
          (id, year, name, color, created_at, updated_at)
         SELECT ?, year, ?, ?, ?, ? FROM operating_years WHERE year = ?`
      )
      .bind(roleId, parsed.output.name, parsed.output.color, now, now, year),
    ...parsed.output.permissions.map((permission) =>
      c.env.shift_app
        .prepare(
          `INSERT INTO year_role_permissions (role_id, permission, created_at)
           SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM year_roles WHERE id = ?)`
        )
        .bind(roleId, permission, now, roleId)
    ),
  ]
  const results = await c.env.shift_app.batch(statements)
  if (results[0]?.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "ROLE_CONFLICT",
      "Year is missing or role name already exists"
    )
  }

  return c.json({ role: { id: roleId, year, ...parsed.output } }, 201)
})
