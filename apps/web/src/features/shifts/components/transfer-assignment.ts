import type { EditorData } from "../editor-data"
import type { Assignment } from "./assign-member"
import { assignMember } from "./assign-member"
import type { OverviewDrafts } from "./overview-draft"
import { planOf } from "./use-shift-plan"

export function assignmentEditWarning(
  source: EditorData,
  value: Assignment,
  now = Date.now()
) {
  const saved = source.slots.find(
    (slot) =>
      slot.id === value.slotId && slot.memberIds.includes(value.memberId)
  )
  if (!saved) return null
  const state = source.assignmentStates?.find(
    (item) => item.slotId === value.slotId && item.memberId === value.memberId
  )
  const ended = Date.parse(saved.endsAt) <= now
  if (state?.recorded)
    return `${ended ? "終了済みで、" : ""}勤怠記録のある勤務です。変更しますか？`
  return ended ? "終了済みの勤務です。変更しますか？" : null
}

/** Both plans form one undo step and one atomic save. Never reuse another activity's slot ID. */
export function transferAssignment(
  source: EditorData,
  destination: EditorData,
  drafts: OverviewDrafts,
  value: Assignment
): { updates: OverviewDrafts } | { error: string } {
  const from = drafts[source.activity.id]?.plan ?? planOf(source)
  const to = drafts[destination.activity.id]?.plan ?? planOf(destination)
  if (
    value.slotId &&
    !from.slots.some(
      (slot) =>
        slot.id === value.slotId && slot.memberIds.includes(value.memberId)
    )
  )
    return {
      error: "この勤務は変更または解除されています。一覧を更新してください。",
    }
  const result = assignMember(to, { ...value, slotId: null }, [])
  if ("error" in result) return result
  return {
    updates: {
      [source.activity.id]: {
        base: drafts[source.activity.id]?.base ?? planOf(source),
        atomic: true,
        plan: {
          ...from,
          slots: from.slots.map((slot) =>
            slot.id === value.slotId
              ? {
                  ...slot,
                  memberIds: slot.memberIds.filter(
                    (id) => id !== value.memberId
                  ),
                }
              : slot
          ),
        },
      },
      [destination.activity.id]: {
        base: drafts[destination.activity.id]?.base ?? planOf(destination),
        atomic: true,
        plan: { ...to, slots: result.slots },
      },
    },
  }
}
