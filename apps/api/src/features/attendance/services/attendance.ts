import { toIso } from "../../../lib/http"

/** An assignment's attendance columns, from `assignment_attendance` joined as `attendance`. */
export const attendanceColumns = `attendance.state AS attendanceState,
  attendance.expected_at AS attendanceExpectedAt, attendance.reason AS attendanceReason,
  attendance.checked_in_at AS attendanceCheckedInAt,
  attendance.check_in_status AS attendanceCheckInStatus,
  attendance.resolved_at AS attendanceResolvedAt, attendance.updated_at AS attendanceUpdatedAt`

export type AttendanceColumns = {
  attendanceState: "late" | "absent" | "present" | null
  attendanceExpectedAt: number | null
  attendanceReason: string | null
  attendanceCheckedInAt: number | null
  attendanceCheckInStatus: "pending" | "confirmed" | null
  attendanceResolvedAt: number | null
  attendanceUpdatedAt: number | null
}

const iso = (value: number | null) => (value === null ? null : toIso(value))

/** The attendance of a row read with `attendanceColumns`, or null when there is none. */
export function attendanceJson(row: AttendanceColumns) {
  if (row.attendanceState === null || row.attendanceUpdatedAt === null)
    return null
  return {
    state: row.attendanceState,
    expectedAt: iso(row.attendanceExpectedAt),
    reason: row.attendanceReason ?? "",
    checkedInAt: iso(row.attendanceCheckedInAt),
    checkInStatus: row.attendanceCheckInStatus,
    resolvedAt: iso(row.attendanceResolvedAt),
    updatedAt: toIso(row.attendanceUpdatedAt),
  }
}

/** A row with its attendance columns replaced by the attendance they describe. */
export function withAttendance<T extends AttendanceColumns>(row: T) {
  const {
    attendanceState,
    attendanceExpectedAt,
    attendanceReason,
    attendanceCheckedInAt,
    attendanceCheckInStatus,
    attendanceResolvedAt,
    attendanceUpdatedAt,
    ...rest
  } = row
  return {
    ...rest,
    attendance: attendanceJson({
      attendanceState,
      attendanceExpectedAt,
      attendanceReason,
      attendanceCheckedInAt,
      attendanceCheckInStatus,
      attendanceResolvedAt,
      attendanceUpdatedAt,
    }),
  }
}
