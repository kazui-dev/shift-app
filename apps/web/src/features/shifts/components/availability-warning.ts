import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"

export function hasUnavailableAssignments(
  plan: ActivityEditorInput,
  availability: EditorData["availability"],
  acknowledged: EditorData["availability"] = []
) {
  return plan.slots.some((slot) =>
    slot.memberIds.some(
      (memberId) =>
        !acknowledged.some(
          (item) =>
            item.memberId === memberId &&
            item.startsAt === slot.startsAt &&
            item.endsAt === slot.endsAt
        ) &&
        !availability.some(
          (window) =>
            window.memberId === memberId &&
            Date.parse(window.startsAt) <= Date.parse(slot.startsAt) &&
            Date.parse(window.endsAt) >= Date.parse(slot.endsAt)
        )
    )
  )
}
