import { recordD1 } from "../../../lib/d1-metrics"
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
        `SELECT a.id, a.slot_id AS slotId, a.member_id AS memberId FROM ${planningAssignments} a JOIN shift_slots s ON s.id = a.slot_id WHERE s.activity_id = ? AND a.status = 'active'`
      )
      .bind(id)
      .all<{ id: string; slotId: string; memberId: string }>()
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
        "SELECT id, name, color FROM year_roles WHERE year = ? ORDER BY position DESC"
      )
      .bind(activity.year)
      .all<{ id: string; name: string; color: string }>()
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
      .prepare(
        `SELECT a.member_id AS memberId, s.starts_at AS startsAt, s.ends_at AS endsAt, act.name FROM ${planningAssignments} a JOIN shift_slots s ON s.id = a.slot_id JOIN activities act ON act.id = s.activity_id WHERE a.status = 'active' AND act.id <> ? AND act.year = ?`
      )
      .bind(id, activity.year)
      .all<{
        memberId: string
        startsAt: number
        endsAt: number
        name: string
      }>()
      .then((query) => recordD1("activity.editor.other_assignments", query)),
  ])
  return {
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
    roles: roles.results,
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
