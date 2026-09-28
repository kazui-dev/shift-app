import type { CalendarAssignment } from "@/features/shifts/api/assignments"

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
