import type { MemberContext } from "../../lib/http"
import { canManageShifts } from "./membership"

/** Shift managers and current responsibles may manage an activity's work. */
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
