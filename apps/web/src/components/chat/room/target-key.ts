import type { ChatTargetOption } from "@workspace/shared/communications"
export const targetKey = (
  target: Pick<ChatTargetOption, "targetType" | "targetId">
) => `${target.targetType}:${target.targetId}`
