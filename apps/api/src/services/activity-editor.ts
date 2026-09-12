import { toIso } from "../lib/http"
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
    assignments,
    members,
    roles,
    memberRoles,
    availability,
    submitted,
    others,
  ] = await Promise.all([
    db
      .prepare(
        "SELECT role_id AS roleId FROM activity_candidate_roles WHERE activity_id=?"
      )
      .bind(id)
      .all<{ roleId: string }>(),
    db
      .prepare(
        "SELECT target_type AS targetType, target_id AS targetId FROM activity_responsibles WHERE activity_id = ?"
      )
      .bind(id)
      .all<{ targetType: "member" | "role"; targetId: string }>(),
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
      }>(),
    db
      .prepare(
        "SELECT a.id, a.slot_id AS slotId, a.member_id AS memberId FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id WHERE s.activity_id = ? AND a.status = 'active'"
      )
      .bind(id)
      .all<{ id: string; slotId: string; memberId: string }>(),
    db
      .prepare(
        "SELECT m.id, identity.image, m.display_name AS displayName, m.student_id AS studentId FROM year_memberships ym JOIN app_users m ON m.id = ym.member_id LEFT JOIN user identity ON identity.id = m.user_id WHERE ym.year = ? AND ym.status = 'active' ORDER BY m.student_id"
      )
      .bind(activity.year)
      .all<{
        id: string
        image: string | null
        displayName: string
        studentId: string
      }>(),
    db
      .prepare(
        "SELECT id, name, color FROM year_roles WHERE year = ? ORDER BY position DESC"
      )
      .bind(activity.year)
      .all<{ id: string; name: string; color: string }>(),
    db
      .prepare(
        "SELECT mr.member_id AS memberId, r.id, r.name, r.color FROM member_year_roles mr JOIN year_roles r ON r.id = mr.role_id WHERE r.year = ?"
      )
      .bind(activity.year)
      .all<{ memberId: string; id: string; name: string; color: string }>(),
    db
      .prepare(
        `SELECT s.member_id AS memberId, w.starts_at AS startsAt, w.ends_at AS endsAt FROM availability_submissions s JOIN availability_windows w ON w.submission_id = s.id WHERE s.year = ? AND s.status = 'submitted'`
      )
      .bind(activity.year)
      .all<{ memberId: string; startsAt: number; endsAt: number }>(),
    db
      .prepare(
        "SELECT member_id AS memberId FROM availability_submissions WHERE year = ? AND status = 'submitted'"
      )
      .bind(activity.year)
      .all<{ memberId: string }>(),
    db
      .prepare(
        `SELECT a.member_id AS memberId, s.starts_at AS startsAt, s.ends_at AS endsAt, act.name FROM shift_assignments a JOIN shift_slots s ON s.id = a.slot_id JOIN activities act ON act.id = s.activity_id WHERE a.status = 'active' AND act.id <> ? AND act.year = ?`
      )
      .bind(id, activity.year)
      .all<{
        memberId: string
        startsAt: number
        endsAt: number
        name: string
      }>(),
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
    members: members.results.map((member) => ({
      ...member,
      roles: memberRoles.results
        .filter((r) => r.memberId === member.id)
        .map(({ id: roleId, name, color }) => ({ id: roleId, name, color })),
    })),
    roles: roles.results,
    availability: availability.results.map((item) => ({
      ...item,
      startsAt: toIso(item.startsAt),
      endsAt: toIso(item.endsAt),
    })),
    submittedMemberIds: submitted.results.map((item) => item.memberId),
    otherAssignments: others.results.map((item) => ({
      ...item,
      startsAt: toIso(item.startsAt),
      endsAt: toIso(item.endsAt),
    })),
  }
}
