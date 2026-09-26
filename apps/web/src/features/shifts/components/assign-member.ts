import type { ActivityEditorInput } from "@workspace/shared/shifts"

type Slot = ActivityEditorInput["slots"][number]
type Window = { memberId: string; startsAt: string; endsAt: string }
export type Assignment = {
  memberId: string
  slotId: string | null
  startsAt: string
  endsAt: string
}

/**
 * Moves a member into the requested window, merging into a slot that already
 * covers it. Returns the reason instead when the window cannot hold them.
 */
export function assignMember(
  plan: ActivityEditorInput,
  value: Assignment,
  otherAssignments: Window[]
): { error: string } | { slots: Slot[]; slotId: string } {
  const start = Date.parse(value.startsAt),
    end = Date.parse(value.endsAt)
  if (start < Date.parse(plan.startsAt) || end > Date.parse(plan.endsAt))
    return { error: "シフトの開始・終了の範囲内で指定してください。" }
  const overlaps = (window: { startsAt: string; endsAt: string }) =>
    Date.parse(window.startsAt) < end && Date.parse(window.endsAt) > start
  if (
    otherAssignments.some(
      (item) => item.memberId === value.memberId && overlaps(item)
    ) ||
    plan.slots.some(
      (slot) =>
        slot.id !== value.slotId &&
        slot.memberIds.includes(value.memberId) &&
        overlaps(slot)
    )
  )
    return { error: "この時間には別のシフトがあります。" }
  const original = plan.slots.find((slot) => slot.id === value.slotId)
  const destination = plan.slots.find(
    (slot) => slot.startsAt === value.startsAt && slot.endsAt === value.endsAt
  )
  const slotId =
    destination?.id ??
    (original?.memberIds.length === 1 ? original.id : crypto.randomUUID())
  const slots = plan.slots
    .map((slot) => ({
      ...slot,
      memberIds:
        slot.id === value.slotId
          ? slot.memberIds.filter((member) => member !== value.memberId)
          : slot.memberIds,
    }))
    .filter((slot) => slot.id !== slotId)
  slots.push({
    id: slotId,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    capacity: destination?.capacity ?? original?.capacity ?? null,
    memberIds: [
      ...new Set([
        ...(destination?.memberIds ?? []).filter(
          (member) => member !== value.memberId
        ),
        value.memberId,
      ]),
    ],
  })
  return {
    slots: slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    slotId,
  }
}
