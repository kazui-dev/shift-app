import type { InferOutput } from "valibot"
import type { chatTargetSchema } from "@workspace/shared/communications"

type Target = InferOutput<typeof chatTargetSchema>
export async function targetExists(
  env: CloudflareBindings,
  year: number,
  target: Target
) {
  if (target.targetType === "year") return target.targetId === String(year)
  if (target.targetType === "access_level")
    return target.targetId === "system_admin"
  if (target.targetType === "permission")
    return [
      "shift.create",
      "shift.manage",
      "member.manage",
      "role.manage",
    ].includes(target.targetId)
  const queries = {
    member:
      "SELECT 1 AS found FROM year_memberships WHERE member_id=? AND year=? AND status='active'",
    role: "SELECT 1 AS found FROM year_roles WHERE id=? AND year=?",
    activity: "SELECT 1 AS found FROM activities WHERE id=? AND year=?",
    responsible: "SELECT 1 AS found FROM activities WHERE id=? AND year=?",
  }
  return (
    (
      await env.shift_app
        .prepare(queries[target.targetType])
        .bind(target.targetId, year)
        .first<{ found: number }>()
    )?.found === 1
  )
}
