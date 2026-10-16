import type { ShiftOverview } from "@workspace/shared/shifts"
import {
  planningAssignments,
  planningMembers,
} from "../../directory/services/directory-work"
import {
  planningAvailability,
  planningAvailabilityAnswers,
  planningMemberRoles,
} from "../../directory/services/planning-inputs"
import { toIso } from "../../../lib/http"

export async function readShiftOverview(
  db: D1Database,
  year: number,
  date: string,
  actorId: string,
  canEdit: boolean
): Promise<ShiftOverview> {
  const start = Date.parse(`${date}T00:00:00+09:00`),
    end = start + 86_400_000
  const [activities, assignments, members, roles, availability, answers] =
    await Promise.all([
      db
        .prepare(`SELECT a.id,a.name,a.color,a.active,a.starts_at AS startsAt,a.ends_at AS endsAt
      FROM activities a WHERE a.year=? AND a.starts_at<? AND a.ends_at>?
      AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=a.id AND r.member_id=?))
      ORDER BY a.starts_at,a.name`)
        .bind(year, end, start, canEdit ? 1 : 0, actorId)
        .all<{
          id: string
          name: string
          color: string
          active: number
          startsAt: number
          endsAt: number
        }>(),
      db
        .prepare(`SELECT p.id,p.slot_id AS slotId,s.activity_id AS activityId,p.member_id AS memberId,s.starts_at AS startsAt,s.ends_at AS endsAt,
      attendance.state,attendance.check_in_status AS checkInStatus,attendance.checked_in_at AS checkedInAt,attendance.expected_at AS expectedAt,attendance.resolved_at AS resolvedAt
      FROM ${planningAssignments} p JOIN shift_slots s ON s.id=p.slot_id JOIN activities a ON a.id=s.activity_id
      LEFT JOIN assignment_attendance attendance ON attendance.assignment_id=p.id
      WHERE a.year=? AND s.starts_at<? AND s.ends_at>? AND p.status='active' AND s.deleted=0
      AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=a.id AND r.member_id=?))
      ORDER BY s.starts_at,s.ends_at,p.id`)
        .bind(year, end, start, canEdit ? 1 : 0, actorId)
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
        }>(),
      db
        .prepare(
          `SELECT m.id,m.display_name AS displayName,m.student_id AS studentId,u.image FROM ${planningMembers} m LEFT JOIN user u ON u.id=m.user_id WHERE m.year=? ORDER BY m.student_id`
        )
        .bind(year)
        .all<{
          id: string
          displayName: string
          studentId: string
          image: string | null
        }>(),
      db
        .prepare(planningMemberRoles)
        .bind(year)
        .all<{ memberId: string; id: string; name: string; color: string }>(),
      db.prepare(planningAvailability).bind(year).all<{
        memberId: string
        startsAt: number | null
        endsAt: number | null
      }>(),
      db.prepare(planningAvailabilityAnswers).bind(year).all<{
        memberId: string
        date: string
        choice: "all" | "times" | "no"
      }>(),
    ])
  const visibleMembers = members.results.filter(
    (m) => canEdit || assignments.results.some((a) => a.memberId === m.id)
  )
  const visibleIds = new Set(visibleMembers.map((m) => m.id))
  const visibleRoles = roles.results.filter((r) => visibleIds.has(r.memberId))
  const iso = (n: number | null) => (n === null ? null : toIso(n))
  return {
    canEdit,
    activities: activities.results.map((a) => ({
      ...a,
      active: a.active === 1,
      startsAt: toIso(a.startsAt),
      endsAt: toIso(a.endsAt),
    })),
    assignments: assignments.results.map((a) => ({
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
    })),
    members: visibleMembers.map((m) => ({
      ...m,
      roles: visibleRoles
        .filter((r) => r.memberId === m.id)
        .map(({ id, name, color }) => ({ id, name, color })),
    })),
    roles: [
      ...new Map(
        visibleRoles.map(({ id, name, color }) => [id, { id, name, color }])
      ).values(),
    ],
    availability: availability.results.flatMap((w) => {
      if (
        !visibleIds.has(w.memberId) ||
        w.startsAt === null ||
        w.endsAt === null
      )
        return []
      const from = Math.max(start, w.startsAt),
        to = Math.min(end, w.endsAt)
      if (from >= to) return []
      // A responsible sees availability only within the shifts they oversee.
      const windows = canEdit
        ? [{ startsAt: from, endsAt: to }]
        : activities.results
            .filter((a) =>
              assignments.results.some(
                (s) => s.activityId === a.id && s.memberId === w.memberId
              )
            )
            .map((a) => ({
              startsAt: Math.max(from, a.startsAt),
              endsAt: Math.min(to, a.endsAt),
            }))
      return windows
        .filter((window) => window.startsAt < window.endsAt)
        .map((x) => ({
          memberId: w.memberId,
          startsAt: toIso(x.startsAt),
          endsAt: toIso(x.endsAt),
        }))
    }),
    availabilityAnswers: canEdit
      ? answers.results.filter(
          (a) => a.date === date && visibleIds.has(a.memberId)
        )
      : [],
  }
}
