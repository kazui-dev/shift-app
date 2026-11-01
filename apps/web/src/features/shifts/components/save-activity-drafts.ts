import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { ApiError } from "@/lib/http/client"
import { getActivity, saveActivity, saveActivityPlans } from "../api/activities"
import type { EditorData } from "../editor-data"
import type { OverviewDraft, OverviewDrafts } from "./overview-draft"
import { mergePlan } from "./merge-plan"
import { planOf } from "./use-shift-plan"

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const conflict = () =>
  new ApiError(
    "同じ勤務または設定への変更が競合しています。編集内容は保持しています。",
    409,
    "SHIFT_CHANGED"
  )

export function mergeActivityDraft(
  draft: OverviewDraft,
  latest: ActivityEditorInput
) {
  const { base, plan: local } = draft
  const window = (
    plan: ActivityEditorInput,
    slotId: string,
    memberId: string
  ) => {
    const slot = plan.slots.find(
      (item) => item.id === slotId && item.memberIds.includes(memberId)
    )
    return slot ? [slot.startsAt, slot.endsAt] : null
  }
  const additions = (plan: ActivityEditorInput, memberId: string) =>
    plan.slots
      .filter(
        (slot) =>
          slot.memberIds.includes(memberId) &&
          !base.slots.some(
            (before) =>
              before.id === slot.id && before.memberIds.includes(memberId)
          )
      )
      .map((slot) => `${slot.startsAt}/${slot.endsAt}`)
      .sort()
  for (const slot of base.slots) {
    for (const memberId of slot.memberIds) {
      const before = [slot.startsAt, slot.endsAt]
      const ours = window(local, slot.id, memberId)
      const theirs = window(latest, slot.id, memberId)
      if (
        (!ours || !theirs) &&
        !same(ours, before) &&
        !same(theirs, before) &&
        !same(ours, theirs)
      )
        throw conflict()
      if (
        !ours &&
        !theirs &&
        !same(additions(local, memberId), additions(latest, memberId))
      )
        throw conflict()
    }
  }
  const retainEmptySlots = (
    plan: ActivityEditorInput
  ): ActivityEditorInput => ({
    ...plan,
    slots: [
      ...plan.slots,
      ...base.slots
        .filter((slot) => !plan.slots.some((item) => item.id === slot.id))
        .map((slot) => ({ ...slot, memberIds: [] })),
    ],
  })
  const localSlots = local.slots.flatMap((slot) => {
    const memberIds = slot.memberIds.filter((memberId) => {
      if (
        base.slots.some(
          (before) =>
            before.id === slot.id && before.memberIds.includes(memberId)
        )
      )
        return true
      return !latest.slots.some(
        (other) =>
          other.id !== slot.id &&
          other.memberIds.includes(memberId) &&
          other.startsAt === slot.startsAt &&
          other.endsAt === slot.endsAt &&
          !base.slots.some(
            (before) =>
              before.id === other.id && before.memberIds.includes(memberId)
          )
      )
    })
    return slot.memberIds.length &&
      !memberIds.length &&
      !base.slots.some((before) => before.id === slot.id)
      ? []
      : [{ ...slot, memberIds }]
  })
  const merged = mergePlan(
    base,
    retainEmptySlots({ ...local, slots: localSlots }),
    retainEmptySlots(latest)
  )
  if (merged.conflicts.length) throw conflict()
  return merged.plan
}

function retryable(error: unknown) {
  return (
    error instanceof ApiError &&
    [
      "SHIFT_CHANGED",
      "ASSIGNMENT_TRANSFER_CHANGED",
      "ASSIGNMENT_OVERWRITE_CHANGED",
    ].includes(error.code)
  )
}

export async function saveActivityDraft(
  id: string,
  draft: OverviewDraft,
  persist: (
    id: string,
    plan: ActivityEditorInput
  ) => Promise<EditorData> = saveActivity,
  attempt = 0
): Promise<EditorData> {
  const latest = await getActivity(id)
  const plan = mergeActivityDraft(draft, planOf(latest))
  try {
    return await persist(id, plan)
  } catch (error) {
    if (attempt >= 2 || !retryable(error)) throw error
    return saveActivityDraft(id, draft, persist, attempt + 1)
  }
}

export async function saveActivityDrafts(
  drafts: OverviewDrafts,
  attempt = 0
): Promise<Awaited<ReturnType<typeof saveActivityPlans>>> {
  const plans = await Promise.all(
    Object.entries(drafts).map(async ([id, draft]) => ({
      id,
      plan: mergeActivityDraft(draft, planOf(await getActivity(id))),
    }))
  )
  try {
    return await saveActivityPlans(plans)
  } catch (error) {
    if (attempt >= 2 || !retryable(error)) throw error
    return saveActivityDrafts(drafts, attempt + 1)
  }
}
