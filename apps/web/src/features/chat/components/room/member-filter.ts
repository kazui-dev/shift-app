import type { ChatTargetOption } from "@workspace/shared/communications"

export function matchesMemberFilter(
  member: Extract<ChatTargetOption, { targetType: "member" }>,
  roleIds: string[],
  activityIds: string[]
) {
  return (
    (!roleIds.length || roleIds.some((id) => member.roleIds.includes(id))) &&
    (!activityIds.length ||
      activityIds.some((id) => member.activityIds.includes(id)))
  )
}
