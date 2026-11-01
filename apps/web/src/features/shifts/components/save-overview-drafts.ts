import { ApiError, errorMessage } from "@/lib/http/client"
import {
  saveActivity,
  reviewActivityOverlaps,
  overwriteActivity,
} from "../api/activities"
import { saveActivityDraft, saveActivityDrafts } from "./save-activity-drafts"
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
  confirmOverwrite: ConfirmOverwrite | undefined
): Promise<{ saved: EditorData } | { cancelled: true }> {
  let cancelled = false
  try {
    const saved = await saveActivityDraft(
      id,
      draft,
      async (activityId, plan) => {
        try {
          return await saveActivity(activityId, plan)
        } catch (failure) {
          if (
            !(
              failure instanceof ApiError &&
              failure.code === "SHIFT_OVERLAP" &&
              confirmOverwrite
            )
          )
            throw failure
          const review = await reviewActivityOverlaps(activityId, plan)
          if (
            review.changes.length &&
            !(await confirmOverwrite({ id: activityId, plan, review }))
          ) {
            cancelled = true
            throw failure
          }
          return overwriteActivity(activityId, plan, review.token)
        }
      }
    )
    return { saved }
  } catch (error) {
    if (cancelled) return { cancelled: true }
    throw error
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
  if (
    Object.values(drafts).some(
      (draft) => draft.atomic || draft.plan.releasedAssignments?.length
    )
  ) {
    try {
      const result = await saveActivityDrafts(drafts)
      return {
        remaining: {},
        failures,
        confirmed: result.activities.map((saved) => ({
          id: saved.activity.id,
          saved,
        })),
        cancelled,
      }
    } catch (failure) {
      return {
        remaining,
        failures: [errorMessage(failure)],
        confirmed,
        cancelled,
      }
    }
  }
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
