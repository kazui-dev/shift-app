import {
  attendanceColumns,
  attendanceJson,
  type AttendanceColumns,
} from "./attendance"
import {
  attendanceNotice,
  type AttendanceReport,
} from "../domain/attendance-notice"
import { postBotMessage } from "../../chat/services/bots"

export type ShiftRow = {
  assignmentId: string
  memberId: string
  memberDisplayName: string
  activityId: string
  activityName: string
  year: number
  active: number
  startsAt: number
  endsAt: number
  roomId: string | null
} & AttendanceColumns

/** An assignment with its shift and attendance, whoever it belongs to. */
export function findShift(env: CloudflareBindings, assignmentId: string) {
  return env.shift_app
    .prepare(`SELECT a.id AS assignmentId, a.member_id AS memberId, m.display_name AS memberDisplayName,
    activity.id AS activityId, activity.name AS activityName, activity.year,
    s.starts_at AS startsAt, s.ends_at AS endsAt, room.room_id AS roomId,
    (a.status = 'active' AND activity.active = 1 AND EXISTS (
      SELECT 1 FROM year_memberships ym WHERE ym.member_id = a.member_id AND ym.year = activity.year AND ym.status = 'active'
    )) AS active, ${attendanceColumns}
    FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id
    JOIN activities activity ON activity.id = s.activity_id JOIN app_users m ON m.id = a.member_id
    LEFT JOIN assignment_attendance attendance ON attendance.assignment_id = a.id
    LEFT JOIN activity_chat_rooms room ON room.activity_id = activity.id
    WHERE a.id = ?`)
    .bind(assignmentId)
    .first<ShiftRow>()
}

/**
 * Posts the shift room's notice about what a member reported, for the member
 * and the shift's keepers alone: a reason is theirs to share.
 */
export function announceAttendance(
  env: CloudflareBindings,
  shift: ShiftRow,
  report: AttendanceReport
) {
  if (!shift.roomId) return Promise.resolve(null)
  const notice = attendanceNotice({
    ...report,
    displayName: shift.memberDisplayName,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
  })
  return postBotMessage(env, {
    roomId: shift.roomId,
    key: "attendance",
    about: { memberId: shift.memberId, displayName: shift.memberDisplayName },
    private: true,
    ...notice,
  })
}

export async function readAttendance(
  env: CloudflareBindings,
  assignmentId: string
) {
  const shift = await findShift(env, assignmentId)
  return shift ? attendanceJson(shift) : null
}
