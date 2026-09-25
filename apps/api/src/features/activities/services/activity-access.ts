import { canManageYear } from "../../../auth/authorization/role-authority"
import { type MemberContext } from "../../../lib/http"
import { canManageActivity } from "../../../auth/authorization/activity"

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
