import { ApiError, errorMessage } from "@/lib/http/client"
import {
  getActivity,
  saveActivity,
  reviewActivityOverlaps,
  overwriteActivity,
} from "../api/activities"
import { mergeOverviewDraft } from "./overview-draft"
import { planOf } from "./use-shift-plan"
import type {
  ActivityEditorInput,
  AssignmentOverwriteReview,
} from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import type { OverviewDrafts, OverviewDraft } from "./overview-draft"

export type OverviewOverwrite = {
  id: string
  plan: ActivityEditorInput
  review: AssignmentOverwriteReview
}
type ConfirmOverwrite = (request: OverviewOverwrite) => Promise<boolean>
async function saveOne(
  id: string,
  draft: OverviewDraft,
  confirmOverwrite: ConfirmOverwrite | undefined,
  attempt = 0
): Promise<{ saved: EditorData } | { cancelled: true }> {
  const latest = await getActivity(id)
  const merged = mergeOverviewDraft(draft, planOf(latest))
  try {
    try {
      return { saved: await saveActivity(id, merged) }
    } catch (failure) {
      if (
        !(
          failure instanceof ApiError &&
          failure.code === "SHIFT_OVERLAP" &&
          confirmOverwrite
        )
      )
        throw failure
      const review = await reviewActivityOverlaps(id, merged)
      if (
        review.changes.length &&
        !(await confirmOverwrite({ id, plan: merged, review }))
      )
        return { cancelled: true }
      return { saved: await overwriteActivity(id, merged, review.token) }
    }
  } catch (failure) {
    if (
      attempt < 2 &&
      failure instanceof ApiError &&
      ["SHIFT_CHANGED", "ASSIGNMENT_OVERWRITE_CHANGED"].includes(failure.code)
    )
      return saveOne(id, draft, confirmOverwrite, attempt + 1)
    throw failure
  }
}
export async function saveOverviewDrafts(
  drafts: OverviewDrafts,
  confirmOverwrite?: ConfirmOverwrite
) {
  const confirmed: { id: string; saved: EditorData }[] = [],
    remaining = { ...drafts },
    failures: string[] = []
  let cancelled = false
  // Each shift sees earlier saves. Cancellation stops all unprocessed work; failed drafts stay retryable.
  await Object.entries(drafts).reduce(async (previous, [id, draft]) => {
    await previous
    if (cancelled) return
    try {
      const result = await saveOne(id, draft, confirmOverwrite)
      if ("cancelled" in result) {
        cancelled = true
        return
      }
      confirmed.push({ id, saved: result.saved })
      delete remaining[id]
    } catch (failure) {
      failures.push(`${draft.plan.name}：${errorMessage(failure)}`)
    }
  }, Promise.resolve())
  return { remaining, failures, confirmed, cancelled }
}
