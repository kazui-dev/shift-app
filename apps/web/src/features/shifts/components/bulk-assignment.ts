import * as v from "valibot"
import {
  activityEditorInputSchema,
  type ActivityEditorInput,
} from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import { assignmentError, assignMember } from "./assign-member"
import { memberAvailability } from "./member-availability"
import { hasUnavailableAssignments } from "./availability-warning"

export type AssignmentWindow = Pick<ActivityEditorInput, "startsAt" | "endsAt">

export function reviewAssignments(
  data: EditorData,
  plan: ActivityEditorInput,
  memberIds: string[],
  window: AssignmentWindow
) {
  return [...new Set(memberIds)].map((memberId) => {
    const member = data.members.find((item) => item.id === memberId)
    const alreadyAssigned = plan.slots.some(
      (slot) =>
        slot.memberIds.includes(memberId) &&
        Date.parse(slot.startsAt) === Date.parse(window.startsAt) &&
        Date.parse(slot.endsAt) === Date.parse(window.endsAt)
    )
    const error = !member
      ? "対象年度のメンバーではありません。"
      : assignmentError(
          plan,
          { ...window, memberId, slotId: null },
          data.otherAssignments
        )
    const status = memberAvailability(data, window, memberId)
    const outside = hasUnavailableAssignments(
      {
        ...plan,
        slots: [{ ...window, id: "", capacity: null, memberIds: [memberId] }],
      },
      data.availability
    )
    return {
      memberId,
      name: member?.displayName ?? memberId,
      blocked: alreadyAssigned || error !== null,
      reason: alreadyAssigned
        ? "割当済み"
        : (error ??
          (status === "unanswered"
            ? "未回答"
            : status === "unavailable"
              ? "参加不可"
              : outside
                ? "希望時間外"
                : null)),
    }
  })
}

/** One immutable edit, shared slot semantics and validation with single assignments. */
export function assignMembers(
  data: EditorData,
  plan: ActivityEditorInput,
  memberIds: string[],
  window: AssignmentWindow
): { plan: ActivityEditorInput } | { error: string } {
  if (!memberIds.length) return { error: "メンバーを選択してください。" }
  const next = { ...plan }
  for (const memberId of new Set(memberIds)) {
    if (!data.members.some((member) => member.id === memberId))
      return { error: "対象年度のメンバーではありません。" }
    const result = assignMember(
      next,
      { ...window, memberId, slotId: null },
      data.otherAssignments
    )
    if ("error" in result) return result
    next.slots = result.slots
  }
  if (!v.safeParse(activityEditorInputSchema, next).success)
    return {
      error:
        "勤務枠は200件、1つの勤務枠は500人までです。入力内容を確認してください。",
    }
  return { plan: next }
}
