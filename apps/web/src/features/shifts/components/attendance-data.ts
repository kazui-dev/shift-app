import type { getShiftAttendance } from "@/features/shifts/api/assignments"

export type AttendanceData = Awaited<ReturnType<typeof getShiftAttendance>>
