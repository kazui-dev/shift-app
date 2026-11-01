import type {
  ActivityEditorInput,
  ShiftOverview,
} from "@workspace/shared/shifts"
export type OverviewDraft = {
  atomic?: boolean
  base: ActivityEditorInput
  plan: ActivityEditorInput
}
export type OverviewDrafts = Record<string, OverviewDraft>

export function projectOverview(
  data: ShiftOverview,
  drafts: OverviewDrafts
): ShiftOverview {
  return {
    ...data,
    assignments: [
      ...data.assignments.filter((a) => !drafts[a.activityId]),
      ...Object.entries(drafts)
        .filter(([id]) => data.activities.some((a) => a.id === id))
        .flatMap(([activityId, draft]) =>
          draft.plan.slots.flatMap((slot) =>
            slot.memberIds.map((memberId) => {
              const previous = data.assignments.find(
                (a) =>
                  a.activityId === activityId &&
                  a.slotId === slot.id &&
                  a.memberId === memberId
              )
              return {
                id: previous?.id ?? `${slot.id}:${memberId}`,
                activityId,
                slotId: slot.id,
                memberId,
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
                attendance: previous?.attendance ?? null,
              }
            })
          )
        ),
    ],
  }
}
