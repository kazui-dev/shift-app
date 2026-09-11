import type { ActivityEditorInput } from "@workspace/shared/shifts"

type Window = { memberId: string; startsAt: string; endsAt: string }
export function validateShiftPlan(
  input: ActivityEditorInput,
  members: string[],
  other: Window[],
  availability: Window[]
) {
  const start = Date.parse(input.startsAt),
    end = Date.parse(input.endsAt)
  if (start >= end) return { error: "INVALID_TIME_RANGE", outside: [] }
  if (new Set(input.slots.map((slot) => slot.id)).size !== input.slots.length)
    return { error: "DUPLICATE_SLOT", outside: [] }
  const placed: Window[] = [...other]
  const outside = new Set<string>()
  for (const slot of input.slots) {
    const from = Date.parse(slot.startsAt),
      to = Date.parse(slot.endsAt)
    if (from >= to || from < start || to > end)
      return { error: "SLOT_OUTSIDE_SHIFT", outside: [] }
    if (new Set(slot.memberIds).size !== slot.memberIds.length)
      return { error: "DUPLICATE_MEMBER", outside: [] }
    for (const memberId of slot.memberIds) {
      if (!members.includes(memberId))
        return { error: "YEAR_MEMBERSHIP_REQUIRED", outside: [] }
      if (
        placed.some(
          (item) =>
            item.memberId === memberId &&
            Date.parse(item.startsAt) < to &&
            Date.parse(item.endsAt) > from
        )
      )
        return { error: "SHIFT_OVERLAP", outside: [] }
      placed.push({ memberId, startsAt: slot.startsAt, endsAt: slot.endsAt })
      if (
        !availability.some(
          (item) =>
            item.memberId === memberId &&
            Date.parse(item.startsAt) <= from &&
            Date.parse(item.endsAt) >= to
        )
      )
        outside.add(memberId)
    }
  }
  return { error: null, outside: [...outside] }
}
