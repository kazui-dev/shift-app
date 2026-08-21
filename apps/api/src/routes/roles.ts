import { Hono } from "hono"
import * as v from "valibot"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  requireSystemAdmin,
} from "../lib/http"

const idSchema = v.pipe(v.string(), v.uuid())

export const rolesApp = new Hono<ApiEnv>()

rolesApp.get("/:roleId/members", async (c) => {
  const roleId = v.safeParse(idSchema, c.req.param("roleId"))
  if (!roleId.success) {
    return apiError(c, 404, "ROLE_NOT_FOUND", "Year role not found")
  }
  const role = await c.env.shift_app
    .prepare("SELECT id, year, name, color FROM year_roles WHERE id = ?")
    .bind(roleId.output)
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
       JOIN year_memberships year_membership
         ON year_membership.member_id = membership.member_id
        AND year_membership.year = ?
        AND year_membership.status = 'active'
       WHERE membership.role_id = ?
       ORDER BY lower(member.display_name)`
    )
    .bind(role.year, role.id)
    .all<{ id: string; displayName: string; studentId: string }>()
  return c.json({ role, members: members.results })
})

rolesApp.put("/:roleId/members/:memberId", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const roleId = v.safeParse(idSchema, c.req.param("roleId"))
  const memberId = v.safeParse(idSchema, c.req.param("memberId"))
  if (!roleId.success || !memberId.success) {
    return apiError(c, 404, "RESOURCE_NOT_FOUND", "Role or member not found")
  }

  const result = await c.env.shift_app
    .prepare(
      `INSERT OR IGNORE INTO member_year_roles (member_id, role_id, created_at)
       SELECT member.id, role.id, ? FROM members member, year_roles role
       JOIN year_memberships year_membership
         ON year_membership.member_id = member.id
        AND year_membership.year = role.year
        AND year_membership.status = 'active'
       WHERE member.id = ? AND role.id = ?`
    )
    .bind(Date.now(), memberId.output, roleId.output)
    .run()
  if (result.meta.changes !== 1) {
    const resource = await c.env.shift_app
      .prepare(
        `SELECT role.id AS roleId, member.id AS memberId,
                year_membership.status AS membershipStatus
         FROM year_roles role
         JOIN members member ON member.id = ?
         LEFT JOIN year_memberships year_membership
           ON year_membership.member_id = member.id
          AND year_membership.year = role.year
         WHERE role.id = ?`
      )
      .bind(memberId.output, roleId.output)
      .first<{
        roleId: string
        memberId: string
        membershipStatus: "active" | "inactive" | null
      }>()
    if (!resource) {
      return apiError(c, 404, "RESOURCE_NOT_FOUND", "Role or member not found")
    }
    if (resource.membershipStatus !== "active") {
      return apiError(
        c,
        409,
        "YEAR_MEMBERSHIP_REQUIRED",
        "Member must actively participate in the role's year"
      )
    }
  }
  return c.json({
    membership: { roleId: roleId.output, memberId: memberId.output },
  })
})

rolesApp.delete("/:roleId/members/:memberId", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const roleId = v.safeParse(idSchema, c.req.param("roleId"))
  const memberId = v.safeParse(idSchema, c.req.param("memberId"))
  if (!roleId.success || !memberId.success) {
    return apiError(c, 404, "MEMBERSHIP_NOT_FOUND", "Role membership not found")
  }
  const result = await c.env.shift_app
    .prepare(
      "DELETE FROM member_year_roles WHERE role_id = ? AND member_id = ?"
    )
    .bind(roleId.output, memberId.output)
    .run()
  if (result.meta.changes !== 1) {
    return apiError(c, 404, "MEMBERSHIP_NOT_FOUND", "Role membership not found")
  }
  return c.body(null, 204)
})
