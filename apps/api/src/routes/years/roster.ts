import { Hono } from "hono"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  parseYear,
} from "../../lib/http"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const rosterApp = new Hono<ApiEnv>()

rosterApp.get("/:year/roster", async (c) => {
  const year = getYearParam(c.req.param("year"))
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

  const members = await c.env.shift_app
    .prepare(
      `SELECT
         member.id,
         member.display_name AS displayName,
         member.student_id AS studentId,
         role.id AS roleId,
         role.name AS roleName,
         role.color AS roleColor
       FROM year_memberships year_membership
       JOIN members member ON member.id = year_membership.member_id
       LEFT JOIN member_year_roles membership ON membership.member_id = member.id
       LEFT JOIN year_roles role ON role.id = membership.role_id AND role.year = ?
       WHERE year_membership.year = ? AND year_membership.status = 'active'
       ORDER BY lower(member.display_name), lower(role.name)`
    )
    .bind(year, year)
    .all<{
      id: string
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
      displayName: string
      studentId: string
      roles: Array<{ id: string; name: string; color: string }>
    }
  >()
  for (const row of members.results) {
    const member = byId.get(row.id) ?? {
      id: row.id,
      displayName: row.displayName,
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
