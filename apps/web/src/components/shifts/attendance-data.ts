import { japanDateTime } from "@workspace/shared/japan-time"
import type { getShiftAttendance } from "@/api/assignments"

export type AttendanceData = Awaited<ReturnType<typeof getShiftAttendance>>

/** The value a datetime-local input shows for an instant, in Japan time. */
export function localDateTime(value: string) {
  const at = japanDateTime(value)
  return `${at.date}T${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}`
}
