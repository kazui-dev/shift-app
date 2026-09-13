import type { getShiftAttendance } from "@/api/assignments"

export type AttendanceData = Awaited<ReturnType<typeof getShiftAttendance>>
