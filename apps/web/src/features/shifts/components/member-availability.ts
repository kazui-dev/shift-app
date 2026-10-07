import { japanDateStart, japanDateTime } from "@workspace/shared/japan-time"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"

/** Classify against this shift's window; its own allocations remain editable. */
export function memberAvailability(
  data: EditorData,
  plan: Pick<ActivityEditorInput, "startsAt" | "endsAt">,
  memberId: string
): "available" | "unavailable" | "unanswered" {
  const start = Date.parse(plan.startsAt),
    end = Date.parse(plan.endsAt)
  const busy = data.otherAssignments
    .filter((item) => item.memberId === memberId)
    .map((item) => ({
      start: Date.parse(item.startsAt),
      end: Date.parse(item.endsAt),
    }))
    .sort((a, b) => a.start - b.start)
  function hasSpace(from: number, to: number) {
    let cursor = from
    for (const item of busy) {
      if (item.end <= cursor) continue
      if (item.start > cursor) return cursor < to
      cursor = Math.max(cursor, item.end)
      if (cursor >= to) return false
    }
    return cursor < to
  }
  let unanswered = false
  for (
    let day = japanDateStart(japanDateTime(start).date);
    day < end;
    day += 86_400_000
  ) {
    const from = Math.max(start, day),
      to = Math.min(end, day + 86_400_000)
    const answer = data.availabilityAnswers.find(
      (item) =>
        item.memberId === memberId && item.date === japanDateTime(day).date
    )
    if (!answer) {
      if (hasSpace(from, to)) unanswered = true
      continue
    }
    if (answer.choice === "no") continue
    if (
      data.availability.some(
        (item) =>
          item.memberId === memberId &&
          hasSpace(
            Math.max(from, Date.parse(item.startsAt)),
            Math.min(to, Date.parse(item.endsAt))
          )
      )
    )
      return "available"
  }
  return unanswered ? "unanswered" : "unavailable"
}
