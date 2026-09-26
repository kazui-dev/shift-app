import { canManageYear } from "../../../../auth/authorization/role-authority"
import { Hono } from "hono"

import { apiError, errors } from "../../../../lib/errors"
import { type ApiEnv, parseYear } from "../../../../lib/http"
import { canManageShifts } from "../../../../auth/authorization/membership"

export const rosterApp = new Hono<ApiEnv>()

rosterApp.get("/:year/roster", async (c) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) {
    return apiError(c, errors.yearNotFound)
  }
  if (
    !(await canManageShifts(c.env, c.get("member"), year)) &&
    !(await canManageYear(
      c.env.shift_app,
      c.get("member"),
      year,
      "shift.create"
    )) &&
    !(await canManageYear(
      c.env.shift_app,
      c.get("member"),
      year,
      "member.manage"
    )) &&
    !(await canManageYear(
      c.env.shift_app,
      c.get("member"),
      year,
      "role.manage"
    ))
  ) {
    return apiError(c, errors.shiftManagementRequired)
  }

  const members = await c.env.shift_app
    .prepare(
      `SELECT
         member.id,
         member.display_name AS displayName,
         identity.image,
         member.student_id AS studentId,
         role.id AS roleId,
         role.name AS roleName,
         role.color AS roleColor
       FROM year_memberships year_membership
       JOIN app_users member ON member.id = year_membership.member_id
       LEFT JOIN user identity ON identity.id = member.user_id
       LEFT JOIN member_year_roles membership ON membership.member_id = member.id
       LEFT JOIN year_roles role ON role.id = membership.role_id AND role.year = ?
       WHERE year_membership.year = ? AND year_membership.status = 'active'
       ORDER BY member.student_id, role.position DESC`
    )
    .bind(year, year)
    .all<{
      id: string
      image: string | null
      displayName: string
      studentId: string
      roleId: string | null
      roleName: string | null
      roleColor: string | null
    }>()

  const byId = new Map<
    string,
    {
      id: string
      image: string | null
      displayName: string
      studentId: string
      roles: Array<{ id: string; name: string; color: string }>
    }
  >()
  for (const row of members.results) {
    const member = byId.get(row.id) ?? {
      id: row.id,
      displayName: row.displayName,
      image: row.image,
      studentId: row.studentId,
      roles: [],
    }
    if (row.roleId && row.roleName && row.roleColor) {
      member.roles.push({
        id: row.roleId,
        name: row.roleName,
        color: row.roleColor,
      })
    }
    byId.set(row.id, member)
  }

  return c.json({ members: [...byId.values()] })
})
