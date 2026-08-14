import { Hono } from "hono"
import { z } from "zod"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  requireSystemAdmin,
} from "../http"

const idSchema = z.string().uuid()

export const rolesApp = new Hono<ApiEnv>()

rolesApp.get("/:roleId/members", async (c) => {
  const roleId = idSchema.safeParse(c.req.param("roleId"))
  if (!roleId.success) {
    return apiError(c, 404, "ROLE_NOT_FOUND", "Year role not found")
  }
  const role = await c.env.shift_app
    .prepare("SELECT id, year, name, color FROM year_roles WHERE id = ?")
    .bind(roleId.data)
    .first<{ id: string; year: number; name: string; color: string }>()
  if (!role) {
    return apiError(c, 404, "ROLE_NOT_FOUND", "Year role not found")
  }
  if (!(await canManageShifts(c.env, c.get("member"), role.year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }

  const members = await c.env.shift_app
    .prepare(
      `SELECT member.id, member.display_name AS displayName, member.student_id AS studentId
       FROM member_year_roles membership
       JOIN members member ON member.id = membership.member_id
       WHERE membership.role_id = ?
       ORDER BY lower(member.display_name)`
    )
    .bind(role.id)
    .all<{ id: string; displayName: string; studentId: string }>()
  return c.json({ role, members: members.results })
})

rolesApp.put("/:roleId/members/:memberId", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const roleId = idSchema.safeParse(c.req.param("roleId"))
  const memberId = idSchema.safeParse(c.req.param("memberId"))
  if (!roleId.success || !memberId.success) {
    return apiError(c, 404, "RESOURCE_NOT_FOUND", "Role or member not found")
  }

  const result = await c.env.shift_app
    .prepare(
      `INSERT OR IGNORE INTO member_year_roles (member_id, role_id, created_at)
       SELECT member.id, role.id, ? FROM members member, year_roles role
       WHERE member.id = ? AND role.id = ?`
    )
    .bind(Date.now(), memberId.data, roleId.data)
    .run()
  if (result.meta.changes !== 1) {
    const exists = await c.env.shift_app
      .prepare(
        `SELECT 1 AS found FROM member_year_roles
         WHERE member_id = ? AND role_id = ?`
      )
      .bind(memberId.data, roleId.data)
      .first<{ found: number }>()
    if (!exists) {
      return apiError(c, 404, "RESOURCE_NOT_FOUND", "Role or member not found")
    }
  }
  return c.json({
    membership: { roleId: roleId.data, memberId: memberId.data },
  })
})

rolesApp.delete("/:roleId/members/:memberId", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const roleId = idSchema.safeParse(c.req.param("roleId"))
  const memberId = idSchema.safeParse(c.req.param("memberId"))
  if (!roleId.success || !memberId.success) {
    return apiError(c, 404, "MEMBERSHIP_NOT_FOUND", "Role membership not found")
  }
  const result = await c.env.shift_app
    .prepare(
      "DELETE FROM member_year_roles WHERE role_id = ? AND member_id = ?"
    )
    .bind(roleId.data, memberId.data)
    .run()
  if (result.meta.changes !== 1) {
    return apiError(c, 404, "MEMBERSHIP_NOT_FOUND", "Role membership not found")
  }
  return c.body(null, 204)
})
