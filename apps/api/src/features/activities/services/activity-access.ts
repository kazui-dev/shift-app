import { canManageYear } from "../../../auth/authorization/role-authority"
import { type MemberContext } from "../../../lib/http"
import { canManageShifts } from "../../../auth/authorization/membership"
export async function canManageActivity(
  env: CloudflareBindings,
  member: MemberContext,
  id: string,
  year: number
) {
  if (await canManageShifts(env, member, year)) return true
  const row = await env.shift_app
    .prepare(`SELECT 1 AS allowed FROM activity_responsibles r
    JOIN year_memberships ym ON ym.member_id = ? AND ym.year = ? AND ym.status = 'active'
    WHERE r.activity_id = ? AND ((r.target_type = 'member' AND r.target_id = ym.member_id)
    OR (r.target_type = 'role' AND EXISTS (SELECT 1 FROM member_year_roles mr WHERE mr.member_id = ym.member_id AND mr.role_id = r.target_id))) LIMIT 1`)
    .bind(member.id, year, id)
    .first()
  return row !== null
}

export async function canEditActivity(
  env: CloudflareBindings,
  member: MemberContext,
  id: string,
  year: number
) {
  if (await canManageActivity(env, member, id, year)) return true
  if (await canManageYear(env.shift_app, member, year, "shift.create")) {
    const own = await env.shift_app
      .prepare(
        "SELECT id FROM activities WHERE id=? AND created_by=? AND active=0"
      )
      .bind(id, member.id)
      .first()
    if (own) return true
  }
  return false
}
