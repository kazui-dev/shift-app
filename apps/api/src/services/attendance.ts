import { toIso } from "../lib/http"
import { sendMemberNotification } from "./push"

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

/** Tells a shift's responsibles and shift managers that a member is late, absent, or no longer so. */
export async function notifyAttendance(
  env: CloudflareBindings,
  shift: {
    assignmentId: string
    memberId: string
    memberDisplayName: string
    activityId: string
    activityName: string
    year: number
  },
  change: "late" | "absent" | "withdrawn"
) {
  const recipients = await env.shift_app
    .prepare(`SELECT DISTINCT m.id FROM app_users m
    WHERE m.id <> ? AND (m.access_level = 'system_admin' OR EXISTS (
      SELECT 1 FROM year_memberships ym WHERE ym.member_id = m.id AND ym.year = ? AND ym.status = 'active'
      AND (EXISTS (SELECT 1 FROM activity_responsibles r WHERE r.activity_id = ?
        AND ((r.target_type = 'member' AND r.target_id = m.id) OR (r.target_type = 'role' AND EXISTS (SELECT 1 FROM member_year_roles mr WHERE mr.role_id = r.target_id AND mr.member_id = m.id))))
      OR EXISTS (SELECT 1 FROM member_year_roles mr JOIN year_role_permissions p ON p.role_id = mr.role_id JOIN year_roles role ON role.id = mr.role_id
        WHERE mr.member_id = m.id AND role.year = ym.year AND p.permission = 'shift.manage'))))`)
    .bind(shift.memberId, shift.year, shift.activityId)
    .all<{ id: string }>()
  const body = {
    late: `${shift.memberDisplayName}さんが遅刻します。`,
    absent: `${shift.memberDisplayName}さんが欠勤します。`,
    withdrawn: `${shift.memberDisplayName}さんの遅刻・欠勤は取り消されました。`,
  }[change]
  await Promise.all(
    recipients.results.map(({ id }) =>
      sendMemberNotification(
        env,
        id,
        `${shift.activityName}の勤怠`,
        body,
        `/manage/shifts/${shift.activityId}`,
        `attendance-${shift.assignmentId}`
      )
    )
  )
}
