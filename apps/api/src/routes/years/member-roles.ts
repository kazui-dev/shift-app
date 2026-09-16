import { Hono } from "hono"
import * as v from "valibot"
import { memberRoleChangesSchema } from "@workspace/shared/shifts"
import { apiError, errors } from "../../lib/errors"
import { type ApiEnv, parseYear, readJson } from "../../lib/http"
import { roleAuthority } from "../../services/role-authority"
import { announce } from "../announce"

export const memberRolesApp = new Hono<ApiEnv>()
memberRolesApp.patch(
  "/:year/memberships",
  announce({ type: "access_changed" }),
  async (c) => {
    const year = parseYear(c.req.param("year"))
    const parsed = v.safeParse(
      memberRoleChangesSchema,
      await readJson(c.req.raw)
    )
    if (year === null || !parsed.success)
      return apiError(c, errors.invalidRoleChanges)
    const { memberIds, addRoleIds, removeRoleIds } = parsed.output
    if (addRoleIds.some((id) => removeRoleIds.includes(id)))
      return apiError(c, errors.conflictingRoleChanges)
    const roles = [...new Set([...addRoleIds, ...removeRoleIds])]
    const authority = await roleAuthority(
      c.env.shift_app,
      c.get("member"),
      year
    )
    if (!authority.systemAdmin && !authority.permissions.has("member.manage"))
      return apiError(c, errors.memberManagementRequired)
    const [yearRoles, members] = await Promise.all([
      c.env.shift_app
        .prepare(
          `SELECT r.id, r.position, p.permission FROM year_roles r LEFT JOIN year_role_permissions p ON p.role_id = r.id WHERE r.year = ?`
        )
        .bind(year)
        .all<{ id: string; position: number; permission: string | null }>(),
      c.env.shift_app
        .prepare(
          `SELECT m.id, m.access_level AS accessLevel, MAX(r.position) AS position FROM year_memberships ym JOIN app_users m ON m.id = ym.member_id LEFT JOIN member_year_roles mr ON mr.member_id = m.id LEFT JOIN year_roles r ON r.id = mr.role_id AND r.year = ym.year WHERE ym.year = ? AND ym.status = 'active' GROUP BY m.id`
        )
        .bind(year)
        .all<{ id: string; accessLevel: string; position: number | null }>(),
    ])
    for (const roleId of roles) {
      const rows = yearRoles.results.filter((item) => item.id === roleId)
      if (!rows.length) return apiError(c, errors.roleNotFound)
      if (
        !authority.systemAdmin &&
        rows.some(
          (row) =>
            row.position >= authority.position ||
            (row.permission !== null &&
              ![...authority.permissions].some(
                (permission) => permission === row.permission
              ))
        )
      )
        return apiError(c, errors.roleGrantForbidden)
    }
    for (const memberId of memberIds) {
      const member = members.results.find((item) => item.id === memberId)
      if (!member) return apiError(c, errors.memberNotInYear)
      if (
        !authority.systemAdmin &&
        (member.accessLevel === "system_admin" ||
          (member.position ?? Number.NEGATIVE_INFINITY) >= authority.position)
      )
        return apiError(c, errors.memberEditForbidden)
    }
    const now = Date.now()
    const statements = [...new Set(memberIds)].flatMap((memberId) =>
      [...new Set(addRoleIds)]
        .map((roleId) =>
          c.env.shift_app
            .prepare(
              "INSERT OR IGNORE INTO member_year_roles (member_id, role_id, created_at) VALUES (?, ?, ?)"
            )
            .bind(memberId, roleId, now)
        )
        .concat(
          [...new Set(removeRoleIds)].map((roleId) =>
            c.env.shift_app
              .prepare(
                "DELETE FROM member_year_roles WHERE member_id = ? AND role_id = ?"
              )
              .bind(memberId, roleId)
          )
        )
    )
    if (statements.length) await c.env.shift_app.batch(statements)
    return c.body(null, 204)
  }
)
