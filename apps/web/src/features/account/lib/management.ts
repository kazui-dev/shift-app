import type * as v from "valibot"
import type { accessLevelSchema } from "@workspace/shared/auth"

type AccessLevel = v.InferOutput<typeof accessLevelSchema>

/**
 * Whether the management area has anything this member may use: every system
 * area for administrators, otherwise at least one year they can manage.
 */
export function canOpenManagement(
  accessLevel: AccessLevel,
  years: readonly { canManage: boolean }[]
) {
  return accessLevel === "system_admin" || years.some((year) => year.canManage)
}
