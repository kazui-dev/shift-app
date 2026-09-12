import type { ChatTargetOption } from "@workspace/shared/communications"
export const targetKey = (target: ChatTargetOption) =>
  `${target.targetType}:${target.targetId}`
