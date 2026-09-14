import type { CalendarAssignment } from "@/api/assignments"
import { japanTime } from "@workspace/shared/japan-time"

/** How long before a shift starts its card offers check-in. */
const checkInLead = 30 * 60 * 1000

/** The card height from which actions sit on a row under the name and time. */
export const stackedCardHeight = 80

/** Whether a shift's card offers check-in and a late or absence report now. */
export function cardActionsOpen(
  assignment: Pick<CalendarAssignment, "startsAt" | "endsAt" | "checkedInAt">,
  now: number
) {
  return (
    !assignment.checkedInAt &&
    now >= Date.parse(assignment.startsAt) - checkInLead &&
    now < Date.parse(assignment.endsAt)
  )
}

/** Whether a late or absence report can still be sent for a shift. */
export const reportOpen = (
  assignment: Pick<CalendarAssignment, "endsAt">,
  now: number
) => now < Date.parse(assignment.endsAt)

/** A standing report, or null once it has been taken back. */
export const standingReport = (
  assignment: Pick<CalendarAssignment, "report">
) =>
  assignment.report && assignment.report.status !== "withdrawn"
    ? assignment.report
    : null

/** How a standing report reads on its shift, as the report button's label. */
export function reportLabel(assignment: Pick<CalendarAssignment, "report">) {
  const report = standingReport(assignment)
  if (!report) return "遅刻・欠勤"
  if (report.kind === "absence") return "欠勤連絡済み"
  return report.eta
    ? `遅刻連絡済み・${japanTime(report.eta)}到着`
    : "遅刻連絡済み"
}
