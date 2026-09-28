import type { ShiftPermission } from "@workspace/shared/shifts"

import type { MemberContext } from "../../lib/http"

export async function canManageShifts(
  env: CloudflareBindings,
  member: MemberContext,
  year: number
): Promise<boolean> {
  if (member.accessLevel === "system_admin") {
    return true
  }

  const row = await env.shift_app
    .prepare(
      `SELECT 1 AS allowed
       FROM member_year_roles member_role
       JOIN year_roles role ON role.id = member_role.role_id
       JOIN year_memberships year_membership
         ON year_membership.year = role.year
        AND year_membership.member_id = member_role.member_id
        AND year_membership.status = 'active'
       JOIN year_role_permissions permission ON permission.role_id = role.id
       WHERE member_role.member_id = ?
         AND role.year = ?
         AND permission.permission = ?
       LIMIT 1`
    )
    .bind(member.id, year, "shift.manage" satisfies ShiftPermission)
    .first<{ allowed: number }>()

  return row?.allowed === 1
}

export async function canAccessYear(
  env: CloudflareBindings,
  member: MemberContext,
  year: number
): Promise<boolean> {
  if (member.accessLevel === "system_admin") return true
  return hasActiveYearMembership(env, member.id, year)
}

export async function hasActiveYearMembership(
  env: CloudflareBindings,
  memberId: string,
  year: number
): Promise<boolean> {
  const row = await env.shift_app
    .prepare(
      `SELECT 1 AS allowed FROM year_memberships
       WHERE year = ? AND member_id = ? AND status = 'active'`
    )
    .bind(year, memberId)
    .first<{ allowed: number }>()
  return row?.allowed === 1
}
