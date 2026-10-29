import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import { planOf } from "./use-shift-plan"
import type { OverviewDrafts } from "./overview-draft"

export type AssignmentTarget = {
  activityId: string
  slotId: string
  memberId: string
}
export function assignmentKey(target: AssignmentTarget) {
  return `${target.activityId}:${target.slotId}:${target.memberId}`
}

/** Keep the work slot and everyone else's assignments, including other slots for the same person. */
export function removeAssignments(
  plan: ActivityEditorInput,
  targets: AssignmentTarget[]
): ActivityEditorInput {
  return {
    ...plan,
    slots: plan.slots.map((slot) => ({
      ...slot,
      memberIds: slot.memberIds.filter(
        (memberId) =>
          !targets.some(
            (target) =>
              target.slotId === slot.id && target.memberId === memberId
          )
      ),
    })),
  }
}

/** Prepare every affected shift before publishing one undoable local change. */
export async function prepareAssignmentRemoval(
  targets: AssignmentTarget[],
  drafts: OverviewDrafts,
  load: (id: string) => Promise<EditorData>
): Promise<OverviewDrafts> {
  const entries = await Promise.all(
    [...new Set(targets.map((target) => target.activityId))].map(async (id) => {
      const previous = drafts[id]
      const base = previous?.base ?? planOf(await load(id))
      const plan = previous?.plan ?? base
      const selected = targets.filter((target) => target.activityId === id)
      if (
        selected.some(
          (target) =>
            !plan.slots.some(
              (slot) =>
                slot.id === target.slotId &&
                slot.memberIds.includes(target.memberId)
            )
        )
      )
        throw new Error(
          "選択した勤務は変更されています。一覧を更新して選び直してください。"
        )
      return [id, { base, plan: removeAssignments(plan, selected) }] as const
    })
  )
  return Object.fromEntries(entries)
}

export function memberSelectionKeys(
  activityId: string,
  memberId: string,
  slots: ActivityEditorInput["slots"]
) {
  const assigned = slots
    .filter((slot) => slot.memberIds.includes(memberId))
    .map((slot) => assignmentKey({ activityId, slotId: slot.id, memberId }))
  return assigned.length ? assigned : [`member:${memberId}`]
}

/** A member with no work still needs a selectable row for bulk assignment. */
export function overviewMemberKeys(
  memberId: string,
  assignments: AssignmentTarget[]
) {
  const keys = assignments.map(assignmentKey)
  return keys.length ? keys : [`member:${memberId}`]
}
