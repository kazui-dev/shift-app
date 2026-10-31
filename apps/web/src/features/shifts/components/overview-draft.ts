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

/** Last save wins for edited members; other members and shift settings stay current. */
export function mergeOverviewDraft(
  draft: OverviewDraft,
  latest: ActivityEditorInput
): ActivityEditorInput {
  const windows = (plan: ActivityEditorInput, member: string) =>
    plan.slots
      .filter((s) => s.memberIds.includes(member))
      .map((s) => `${s.startsAt}/${s.endsAt}`)
      .sort()
      .join("|")
  const members = new Set(
    [...draft.base.slots, ...draft.plan.slots].flatMap((s) => s.memberIds)
  )
  const touched = new Set(
    [...members].filter(
      (member) => windows(draft.base, member) !== windows(draft.plan, member)
    )
  )
  const slots = latest.slots.map((slot) => ({
    ...slot,
    memberIds: slot.memberIds.filter((member) => !touched.has(member)),
  }))
  for (const local of draft.plan.slots) {
    const memberIds = local.memberIds.filter((member) => touched.has(member))
    if (!memberIds.length) continue
    const destination = slots.find(
      (slot) => slot.startsAt === local.startsAt && slot.endsAt === local.endsAt
    )
    if (destination)
      destination.memberIds = [
        ...new Set([...destination.memberIds, ...memberIds]),
      ]
    else
      slots.push({
        ...local,
        id: slots.some((slot) => slot.id === local.id)
          ? crypto.randomUUID()
          : local.id,
        memberIds,
      })
  }
  return { ...latest, slots }
}
