import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "@/features/shifts/editor-data"

type Availability = EditorData["availability"]

/** Keep only windows that intersect the shift being edited. */
export function availabilityDuringShift(
  windows: Availability,
  plan: ActivityEditorInput
): Availability {
  return windows.filter(
    (window) =>
      Date.parse(window.startsAt) < Date.parse(plan.endsAt) &&
      Date.parse(window.endsAt) > Date.parse(plan.startsAt)
  )
}

/** A save needs confirmation when an assignment has no covering answer. */
export function hasAssignmentOutsideAvailability(
  plan: ActivityEditorInput,
  windows: Availability
): boolean {
  return plan.slots.some((slot) =>
    slot.memberIds.some(
      (memberId) =>
        !windows.some(
          (window) =>
            window.memberId === memberId &&
            Date.parse(window.startsAt) <= Date.parse(slot.startsAt) &&
            Date.parse(window.endsAt) >= Date.parse(slot.endsAt)
        )
    )
  )
}
