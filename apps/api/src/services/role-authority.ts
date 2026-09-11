import * as v from "valibot"
import {
  shiftPermissionSchema,
  type ShiftPermission,
} from "@workspace/shared/shifts"
import type { MemberContext } from "../lib/http"

export async function roleAuthority(
  db: D1Database,
  member: MemberContext,
  year: number
) {
  const result = await db
    .prepare(`SELECT r.position, p.permission FROM year_roles r
    JOIN member_year_roles mr ON mr.role_id = r.id AND mr.member_id = ?
    JOIN year_memberships ym ON ym.member_id = mr.member_id AND ym.year = r.year AND ym.status = 'active'
    LEFT JOIN year_role_permissions p ON p.role_id = r.id WHERE r.year = ?`)
    .bind(member.id, year)
    .all<{ position: number; permission: string | null }>()
  const permissions = new Set<ShiftPermission>()
  for (const row of result.results) {
    const parsed = v.safeParse(shiftPermissionSchema, row.permission)
    if (parsed.success) permissions.add(parsed.output)
  }
  return {
    systemAdmin: member.accessLevel === "system_admin",
    position: Math.max(
      Number.NEGATIVE_INFINITY,
      ...result.results.map((row) => row.position)
    ),
    permissions,
  }
}
export async function canManageYear(
  db: D1Database,
  member: MemberContext,
  year: number,
  permission: ShiftPermission
) {
  if (member.accessLevel === "system_admin") return true
  const authority = await roleAuthority(db, member, year)
  return authority.permissions.has(permission)
}
