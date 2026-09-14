import type { CalendarAssignment } from "@/api/assignments"

/** How long before a shift starts its card offers attendance. */
const attendanceLead = 30 * 60 * 1000

/**
 * Whether a shift's card shows its attendance button: from 30 minutes before
 * it starts until it ends, and whenever attendance has been set.
 */
export function attendanceButtonShown(
  assignment: Pick<CalendarAssignment, "startsAt" | "endsAt" | "attendance">,
  now: number
) {
  return (
    !!assignment.attendance ||
    (now >= Date.parse(assignment.startsAt) - attendanceLead &&
      now < Date.parse(assignment.endsAt))
  )
}

/** Whether attendance can still be set for a shift. */
export const attendanceOpen = (
  assignment: Pick<CalendarAssignment, "endsAt" | "attendance">,
  now: number
) =>
  assignment.attendance?.state !== "present" &&
  now < Date.parse(assignment.endsAt)

/** The attendance button's label: what has been set, or 勤怠 before anything is. */
export function attendanceLabel(
  assignment: Pick<CalendarAssignment, "attendance">
) {
  switch (assignment.attendance?.state) {
    case "present":
      return "出勤済"
    case "late":
      return "遅刻"
    case "absent":
      return "欠勤"
    default:
      return "勤怠"
  }
}
