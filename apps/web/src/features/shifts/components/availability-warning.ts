import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"

export function hasUnavailableAssignments(
  plan: ActivityEditorInput,
  availability: EditorData["availability"]
) {
  return plan.slots.some((slot) =>
    slot.memberIds.some(
      (memberId) =>
        !availability.some(
          (window) =>
            window.memberId === memberId &&
            Date.parse(window.startsAt) <= Date.parse(slot.startsAt) &&
            Date.parse(window.endsAt) >= Date.parse(slot.endsAt)
        )
    )
  )
}
