import { roleAuthority } from "../../services/role-authority"
import { Hono } from "hono"
import * as v from "valibot"

import {
  createYearRoleInputSchema,
  reorderRoleInputSchema,
} from "@workspace/shared/shifts"

import { apiError, errors } from "../../lib/errors"
import { type ApiEnv, canAccessYear, parseYear, readJson } from "../../lib/http"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearRolesApp = new Hono<ApiEnv>()

yearRolesApp.get("/:year/roles", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, errors.yearNotFound)
  }
  if (!(await canAccessYear(c.env, c.get("member"), year))) {
    return apiError(c, errors.yearMembershipRequired)
  }

  const roles = await c.env.shift_app
    .prepare(
      `SELECT
         role.id,
         role.position,
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
       ORDER BY role.position DESC, lower(role.name)`
    )
    .bind(year)
    .all<{
      id: string
      position: number
      name: string
      color: string
      permissions: string | null
      memberCount: number
    }>()

  const authority = await roleAuthority(c.env.shift_app, c.get("member"), year)
  return c.json({
    authority: {
      systemAdmin: authority.systemAdmin,
      position: Number.isFinite(authority.position) ? authority.position : null,
      permissions: [...authority.permissions],
    },
    roles: roles.results.map((role) => ({
      ...role,
      year,
      permissions: role.permissions?.split(",") ?? [],
    })),
  })
})

yearRolesApp.post("/:year/roles", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, errors.yearNotFound)
  }
  const parsed = v.safeParse(
    createYearRoleInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(c, errors.invalidRole, parsed.issues[0]?.message)
  }

  const authority = await roleAuthority(c.env.shift_app, c.get("member"), year)
  if (
    !authority.systemAdmin &&
    (!authority.permissions.has("role.manage") ||
      parsed.output.permissions.some(
        (permission) => !authority.permissions.has(permission)
      ))
  ) {
    return apiError(c, errors.roleGrantAuthorityRequired)
  }
  const last = await c.env.shift_app
    .prepare("SELECT MIN(position) AS position FROM year_roles WHERE year = ?")
    .bind(year)
    .first<{ position: number | null }>()
  const position = (last?.position ?? 1) - 1
  const roleId = crypto.randomUUID()
  const now = Date.now()
  const statements = [
    c.env.shift_app
      .prepare(
        `INSERT OR IGNORE INTO year_roles
          (id, year, name, color, created_at, updated_at, position)
         SELECT ?, year, ?, ?, ?, ?, ? FROM operating_years WHERE year = ? RETURNING id`
      )
      .bind(
        roleId,
        parsed.output.name,
        parsed.output.color,
        now,
        now,
        position,
        year
      ),
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
  if (!results[0]?.results.length) {
    return apiError(c, errors.roleConflict)
  }

  return c.json({ role: { id: roleId, year, position, ...parsed.output } }, 201)
})

yearRolesApp.put("/:year/role-order", async (c) => {
  const year = parseYear(c.req.param("year"))
  const input = v.safeParse(reorderRoleInputSchema, await readJson(c.req.raw))
  if (year === null || !input.success)
    return apiError(c, errors.invalidRoleOrder)
  const authority = await roleAuthority(c.env.shift_app, c.get("member"), year)
  if (!authority.systemAdmin && !authority.permissions.has("role.manage"))
    return apiError(c, errors.roleManagementRequired)
  const roles = await c.env.shift_app
    .prepare(
      "SELECT id, position FROM year_roles WHERE year = ? ORDER BY position DESC, id"
    )
    .bind(year)
    .all<{ id: string; position: number }>()
  const ids = input.output.roleIds
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== roles.results.length ||
    roles.results.some((role) => !ids.includes(role.id))
  )
    return apiError(c, errors.roleOrderChanged)
  if (
    !authority.systemAdmin &&
    roles.results.some(
      (role, index) =>
        role.position >= authority.position && ids[index] !== role.id
    )
  )
    return apiError(c, errors.roleOrderForbidden)
  await c.env.shift_app.batch(
    ids.map((id, index) =>
      c.env.shift_app
        .prepare(
          "UPDATE year_roles SET position = ?, updated_at = ? WHERE id = ?"
        )
        .bind(ids.length - index, Date.now(), id)
    )
  )
  return c.body(null, 204)
})
