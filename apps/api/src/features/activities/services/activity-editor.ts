import { recordD1 } from "../../../lib/d1-metrics"
import {
  activityPlanningAssignments,
  planningMembers,
} from "../../directory/services/directory-work"
import {
  planningAvailability,
  planningAvailabilityAnswers,
  planningMemberRoles,
} from "../../directory/services/planning-inputs"
import { toIso } from "../../../lib/http"
// Keep the slot joins inside each branch so the activity/slot indexes can narrow assignments.
export const otherActivityAssignments = `SELECT act.id AS activityId,s.id AS slotId,a.member_id AS memberId, s.starts_at AS startsAt, s.ends_at AS endsAt, act.name
  FROM activities act JOIN shift_slots s ON s.activity_id=act.id
  JOIN shift_assignments a ON a.slot_id=s.id AND a.status='active'
  WHERE act.id <> ? AND act.year = ?
  UNION ALL
  SELECT act.id AS activityId,s.id AS slotId,submission.id AS memberId, s.starts_at AS startsAt, s.ends_at AS endsAt, act.name
  FROM activities act JOIN shift_slots s ON s.activity_id=act.id
  JOIN directory_shift_assignments a ON a.slot_id=s.id
  JOIN directory_availability_submissions submission ON submission.entry_id=a.entry_id
  JOIN student_directory directory ON directory.id=submission.entry_id AND directory.status='active'
  WHERE act.id <> ? AND act.year = ?`

export async function readActivityEditor(db: D1Database, id: string) {
  const activity = await db
    .prepare(
      `SELECT id, year, name, place, activity_type AS activityType, starts_at AS startsAt, ends_at AS endsAt, color, notes, active, version FROM activities WHERE id = ?`
    )
    .bind(id)
    .first<{
      id: string
      year: number
      name: string
      place: string
      activityType: string
      startsAt: number
      endsAt: number
      color: string
      notes: string | null
      active: number
      version: number
    }>()
  if (!activity) return null
  const notices = await db
    .prepare(
      "SELECT id,starts_at AS startsAt,ends_at AS endsAt,content FROM activity_notices WHERE activity_id=? ORDER BY starts_at,id"
    )
    .bind(id)
    .all<{ id: string; startsAt: number; endsAt: number; content: string }>()
  const [
    candidateRoles,
    responsibles,
    slots,
    requirements,
    assignments,
    members,
    roles,
    memberRoles,
    availability,
    availabilityAnswers,
    others,
  ] = await Promise.all([
    db
      .prepare(
        "SELECT role_id AS roleId FROM activity_candidate_roles WHERE activity_id=?"
      )
      .bind(id)
      .all<{ roleId: string }>()
      .then((query) => recordD1("activity.editor.candidate_roles", query)),
    db
      .prepare(
        "SELECT target_type AS targetType, target_id AS targetId FROM activity_responsibles WHERE activity_id = ?"
      )
      .bind(id)
      .all<{ targetType: "member" | "role"; targetId: string }>()
      .then((query) => recordD1("activity.editor.responsibles", query)),
    db
      .prepare(
        "SELECT id, starts_at AS startsAt, ends_at AS endsAt, capacity FROM shift_slots WHERE activity_id = ? AND deleted = 0 ORDER BY starts_at, ends_at, id"
      )
      .bind(id)
      .all<{
        id: string
        startsAt: number
        endsAt: number
        capacity: number | null
      }>()
      .then((query) => recordD1("activity.editor.slots", query)),
    db
      .prepare(
        "SELECT id, starts_at AS startsAt, ends_at AS endsAt, required_count AS requiredCount FROM shift_requirements WHERE activity_id=? ORDER BY starts_at, id"
      )
      .bind(id)
      .all<{
        id: string
        startsAt: number
        endsAt: number
        requiredCount: number
      }>()
      .then((query) => recordD1("activity.editor.requirements", query)),
    db
      .prepare(
        `SELECT a.*, EXISTS(SELECT 1 FROM assignment_attendance WHERE assignment_id=a.id) OR EXISTS(SELECT 1 FROM assignment_attendance_events WHERE assignment_id=a.id) AS recorded FROM (${activityPlanningAssignments}) a`
      )
      .bind(id, id)
      .all<{ id: string; slotId: string; memberId: string; recorded: number }>()
      .then((query) => recordD1("activity.editor.assignments", query)),
    db
      .prepare(
        `SELECT m.id, identity.image, m.display_name AS displayName, m.student_id AS studentId FROM ${planningMembers} m LEFT JOIN user identity ON identity.id = m.user_id WHERE m.year = ? ORDER BY m.student_id`
      )
      .bind(activity.year)
      .all<{
        id: string
        image: string | null
        displayName: string
        studentId: string
      }>()
      .then((query) => recordD1("activity.editor.members", query)),
    db
      .prepare(
        "SELECT id, name, color, id IN (SELECT role_id FROM duties) AS duty FROM year_roles WHERE year = ? ORDER BY position DESC"
      )
      .bind(activity.year)
      .all<{ id: string; name: string; color: string; duty: number }>()
      .then((query) => recordD1("activity.editor.roles", query)),
    db
      .prepare(planningMemberRoles)
      .bind(activity.year)
      .all<{ memberId: string; id: string; name: string; color: string }>()
      .then((query) => recordD1("activity.editor.member_roles", query)),
    db
      .prepare(planningAvailability)
      .bind(activity.year)
      .all<{
        memberId: string
        startsAt: number | null
        endsAt: number | null
      }>()
      .then((query) => recordD1("activity.editor.availability", query)),
    db
      .prepare(planningAvailabilityAnswers)
      .bind(activity.year)
      .all<{ memberId: string; date: string; choice: "all" | "times" | "no" }>()
      .then((query) => recordD1("activity.editor.availability_answers", query)),
    db
      .prepare(otherActivityAssignments)
      .bind(id, activity.year, id, activity.year)
      .all<{
        activityId: string
        slotId: string
        memberId: string
        startsAt: number
        endsAt: number
        name: string
      }>()
      .then((query) => recordD1("activity.editor.other_assignments", query)),
  ])
  return {
    assignmentStates: assignments.results.map(
      ({ slotId, memberId, recorded }) => ({
        slotId,
        memberId,
        recorded: !!recorded,
      })
    ),
    notices: notices.results.map((notice) => ({
      ...notice,
      startsAt: toIso(notice.startsAt),
      endsAt: toIso(notice.endsAt),
    })),
    candidateRoleIds: candidateRoles.results.map((item) => item.roleId),
    activity: {
      ...activity,
      active: activity.active === 1,
      startsAt: toIso(activity.startsAt),
      endsAt: toIso(activity.endsAt),
    },
    responsibles: responsibles.results,
    slots: slots.results.map((slot) => ({
      ...slot,
      startsAt: toIso(slot.startsAt),
      endsAt: toIso(slot.endsAt),
      memberIds: assignments.results
        .filter((a) => a.slotId === slot.id)
        .map((a) => a.memberId),
    })),
    requirements: requirements.results.map((item) => ({
      ...item,
      startsAt: toIso(item.startsAt),
      endsAt: toIso(item.endsAt),
    })),
    members: members.results.map((member) => ({
      ...member,
      roles: memberRoles.results
        .filter((r) => r.memberId === member.id)
        .map(({ id: roleId, name, color }) => ({ id: roleId, name, color })),
    })),
    roles: roles.results.map((role) => ({ ...role, duty: role.duty === 1 })),
    availability: availability.results.flatMap((item) =>
      item.startsAt === null || item.endsAt === null
        ? []
        : [
            {
              ...item,
              startsAt: toIso(item.startsAt),
              endsAt: toIso(item.endsAt),
            },
          ]
    ),
    availabilityAnswers: availabilityAnswers.results,
    submittedMemberIds: [
      ...new Set(availability.results.map((item) => item.memberId)),
    ],
    otherAssignments: others.results.map((item) => ({
      ...item,
      startsAt: toIso(item.startsAt),
      endsAt: toIso(item.endsAt),
    })),
  }
}
