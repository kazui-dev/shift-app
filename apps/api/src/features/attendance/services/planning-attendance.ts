import type { ShiftOverview } from "@workspace/shared/shifts"
import { toIso } from "../../../lib/http"

// Apply visibility and day bounds before combining the two assignment sources.
export const overviewAssignments = `SELECT * FROM (
SELECT p.id,p.slot_id AS slotId,s.activity_id AS activityId,p.member_id AS memberId,s.starts_at AS startsAt,s.ends_at AS endsAt,
      attendance.state,attendance.check_in_status AS checkInStatus,attendance.checked_in_at AS checkedInAt,attendance.expected_at AS expectedAt,attendance.resolved_at AS resolvedAt
      FROM activities a JOIN shift_slots s ON s.activity_id=a.id
      JOIN shift_assignments p ON p.slot_id=s.id
      LEFT JOIN assignment_attendance attendance ON attendance.assignment_id=p.id
      WHERE a.year=? AND s.starts_at<? AND s.ends_at>? AND p.status='active' AND s.deleted=0
      AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=a.id AND r.member_id=?))
      UNION ALL
SELECT p.id,p.slot_id AS slotId,s.activity_id AS activityId,submission.id AS memberId,s.starts_at AS startsAt,s.ends_at AS endsAt,
      attendance.state,attendance.check_in_status AS checkInStatus,attendance.checked_in_at AS checkedInAt,attendance.expected_at AS expectedAt,attendance.resolved_at AS resolvedAt
      FROM activities a JOIN shift_slots s ON s.activity_id=a.id
      JOIN directory_shift_assignments p ON p.slot_id=s.id
      JOIN directory_availability_submissions submission ON submission.entry_id=p.entry_id
      JOIN student_directory directory ON directory.id=submission.entry_id AND directory.status='active'
      LEFT JOIN assignment_attendance attendance ON attendance.assignment_id=p.id
      WHERE a.year=? AND s.starts_at<? AND s.ends_at>? AND s.deleted=0
      AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=a.id AND r.member_id=?))
      ) ORDER BY startsAt,endsAt,id`

export async function readPlanningAttendance(
  db: D1Database,
  year: number,
  start: number,
  end: number,
  actorId: string,
  canEdit: boolean
): Promise<ShiftOverview["assignments"]> {
  const assignments = await db
    .prepare(overviewAssignments)
    .bind(
      year,
      end,
      start,
      canEdit ? 1 : 0,
      actorId,
      year,
      end,
      start,
      canEdit ? 1 : 0,
      actorId
    )
    .all<{
      id: string
      slotId: string
      activityId: string
      memberId: string
      startsAt: number
      endsAt: number
      state: "present" | "late" | "absent" | null
      checkInStatus: "pending" | "confirmed" | null
      checkedInAt: number | null
      expectedAt: number | null
      resolvedAt: number | null
    }>()
  const iso = (n: number | null) => (n === null ? null : toIso(n))
  return assignments.results.map((a) => ({
    id: a.id,
    slotId: a.slotId,
    activityId: a.activityId,
    memberId: a.memberId,
    startsAt: toIso(a.startsAt),
    endsAt: toIso(a.endsAt),
    attendance:
      a.state === null
        ? null
        : {
            state: a.state,
            checkInStatus: a.checkInStatus,
            checkedInAt: iso(a.checkedInAt),
            expectedAt: iso(a.expectedAt),
            resolvedAt: iso(a.resolvedAt),
          },
  }))
}
