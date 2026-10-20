import { ApiError, errorMessage } from "@/lib/http/client"
import { getActivity, saveActivity } from "../api/activities"
import { mergeOverviewDraft } from "./overview-draft"
import { planOf } from "./use-shift-plan"
import type { EditorData } from "../editor-data"
import type { OverviewDrafts, OverviewDraft } from "./overview-draft"
async function saveOne(
  id: string,
  draft: OverviewDraft,
  attempt = 0
): Promise<EditorData> {
  const latest = await getActivity(id)
  const merged = mergeOverviewDraft(draft, planOf(latest))
  try {
    return await saveActivity(id, merged)
  } catch (failure) {
    if (
      attempt < 2 &&
      failure instanceof ApiError &&
      failure.code === "SHIFT_CHANGED"
    )
      return saveOne(id, draft, attempt + 1)
    throw failure
  }
}
export async function saveOverviewDrafts(drafts: OverviewDrafts) {
  const confirmed: { id: string; saved: EditorData }[] = []
  const remaining = { ...drafts }
  const failures: string[] = []
  // Serial writes let later activities see assignments saved earlier in this batch.
  await Object.entries(drafts).reduce(async (previous, [id, draft]) => {
    await previous
    try {
      const saved = await saveOne(id, draft)
      confirmed.push({ id, saved })
      delete remaining[id]
    } catch (failure) {
      failures.push(`${draft.plan.name}：${errorMessage(failure)}`)
    }
  }, Promise.resolve())
  return { remaining, failures, confirmed }
}
