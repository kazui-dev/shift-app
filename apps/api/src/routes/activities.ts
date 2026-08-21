import { Hono } from "hono"
import * as v from "valibot"

import {
  createActivityInputSchema,
  createAssignmentInputSchema,
  updateActivityInputSchema,
} from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  canAccessYear,
  readJson,
  toIso,
} from "../lib/http"
import { notifyAssignmentCreated } from "../services/push"

const idSchema = v.pipe(v.string(), v.uuid())

type ActivityRow = {
  id: string
  year: number
  name: string
  place: string
  activityType: string
  startsAt: number
  endsAt: number
  color: string
  notes: string | null
  yearStatus: "draft" | "active" | "archived"
}

type AssignmentRow = {
  id: string
  activityId: string
  memberId: string
  memberDisplayName: string
  startsAt: number
  endsAt: number
  notes: string | null
  checkedInAt: number | null
}

async function findActivity(
  env: CloudflareBindings,
  activityId: string
): Promise<ActivityRow | null> {
  return env.shift_app
    .prepare(
      `SELECT
         activities.id,
         activities.year,
         activities.name,
         activities.place,
         activities.activity_type AS activityType,
         activities.starts_at AS startsAt,
         activities.ends_at AS endsAt,
         activities.color,
         activities.notes,
         operating_years.status AS yearStatus
       FROM activities
       JOIN operating_years ON operating_years.year = activities.year
       WHERE activities.id = ?`
    )
    .bind(activityId)
    .first<ActivityRow>()
}

function activityJson(activity: ActivityRow) {
  return {
    id: activity.id,
    year: activity.year,
    name: activity.name,
    place: activity.place,
    activityType: activity.activityType,
    startsAt: toIso(activity.startsAt),
    endsAt: toIso(activity.endsAt),
    color: activity.color,
    notes: activity.notes,
  }
}

function assignmentJson(assignment: AssignmentRow) {
  return {
    ...assignment,
    startsAt: toIso(assignment.startsAt),
    endsAt: toIso(assignment.endsAt),
    checkedInAt:
      assignment.checkedInAt === null ? null : toIso(assignment.checkedInAt),
  }
}

export const activitiesApp = new Hono<ApiEnv>()

activitiesApp.get("/:activityId", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("activityId"))
  if (!id.success) {
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "Activity not found")
  }
  const activity = await findActivity(c.env, id.output)
  if (!activity) {
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "Activity not found")
  }
  if (!(await canAccessYear(c.env, c.get("member"), activity.year))) {
    return apiError(c, 403, "FORBIDDEN", "Active year membership is required")
  }
  const assignments = await c.env.shift_app
    .prepare(
      `SELECT
         assignment.id,
         assignment.activity_id AS activityId,
         assignment.member_id AS memberId,
         member.display_name AS memberDisplayName,
         assignment.starts_at AS startsAt,
         assignment.ends_at AS endsAt,
         assignment.notes,
         attendance.checked_in_at AS checkedInAt
       FROM shift_assignments assignment
       JOIN members member ON member.id = assignment.member_id
       LEFT JOIN attendance_records attendance ON attendance.assignment_id = assignment.id
       WHERE assignment.activity_id = ? AND assignment.status = 'active'
       ORDER BY assignment.starts_at, lower(member.display_name)`
    )
    .bind(activity.id)
    .all<AssignmentRow>()
  return c.json({
    activity: activityJson(activity),
    assignments: assignments.results.map(assignmentJson),
  })
})

activitiesApp.patch("/:activityId", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("activityId"))
  if (!id.success) {
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "Activity not found")
  }
  const current = await findActivity(c.env, id.output)
  if (!current) {
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "Activity not found")
  }
  const member = c.get("member")
  if (!(await canManageShifts(c.env, member, current.year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  if (current.yearStatus === "archived") {
    return apiError(c, 409, "YEAR_NOT_EDITABLE", "Operating year is archived")
  }
  const input = v.safeParse(
    updateActivityInputSchema,
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_ACTIVITY",
      input.issues[0]?.message ?? "Invalid activity"
    )
  }
  const merged = v.safeParse(createActivityInputSchema, {
    name: input.output.name ?? current.name,
    place: input.output.place ?? current.place,
    activityType: input.output.activityType ?? current.activityType,
    startsAt: input.output.startsAt ?? toIso(current.startsAt),
    endsAt: input.output.endsAt ?? toIso(current.endsAt),
    color: input.output.color ?? current.color,
    notes:
      input.output.notes === undefined ? current.notes : input.output.notes,
  })
  if (!merged.success) {
    return apiError(
      c,
      422,
      "INVALID_ACTIVITY",
      merged.issues[0]?.message ?? "Invalid activity"
    )
  }
  const startsAt = Date.parse(merged.output.startsAt)
  const endsAt = Date.parse(merged.output.endsAt)
  const result = await c.env.shift_app
    .prepare(
      `UPDATE activities
       SET name = ?, place = ?, activity_type = ?, starts_at = ?, ends_at = ?,
           color = ?, notes = ?, updated_by = ?, updated_at = ?
       WHERE id = ?
         AND NOT EXISTS (
           SELECT 1 FROM shift_assignments assignment
           WHERE assignment.activity_id = activities.id
             AND assignment.status = 'active'
             AND (assignment.starts_at < ? OR assignment.ends_at > ?)
         )`
    )
    .bind(
      merged.output.name,
      merged.output.place,
      merged.output.activityType,
      startsAt,
      endsAt,
      merged.output.color,
      merged.output.notes,
      member.id,
      Date.now(),
      current.id,
      startsAt,
      endsAt
    )
    .run()
  if (result.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "ASSIGNMENT_OUT_OF_RANGE",
      "Existing assignments fall outside the new activity time"
    )
  }
  return c.json({
    activity: activityJson({
      id: current.id,
      year: current.year,
      yearStatus: current.yearStatus,
      ...merged.output,
      startsAt,
      endsAt,
    }),
  })
})

activitiesApp.post("/:activityId/assignments", async (c) => {
  const id = v.safeParse(idSchema, c.req.param("activityId"))
  if (!id.success) {
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "Activity not found")
  }
  const activity = await findActivity(c.env, id.output)
  if (!activity) {
    return apiError(c, 404, "ACTIVITY_NOT_FOUND", "Activity not found")
  }
  const actor = c.get("member")
  if (!(await canManageShifts(c.env, actor, activity.year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  if (activity.yearStatus === "archived") {
    return apiError(c, 409, "YEAR_NOT_EDITABLE", "Operating year is archived")
  }
  const parsed = v.safeParse(
    createAssignmentInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_ASSIGNMENT",
      parsed.issues[0]?.message ?? "Invalid assignment"
    )
  }
  const startsAt = parsed.output.startsAt
    ? Date.parse(parsed.output.startsAt)
    : activity.startsAt
  const endsAt = parsed.output.endsAt
    ? Date.parse(parsed.output.endsAt)
    : activity.endsAt
  if (startsAt < activity.startsAt || endsAt > activity.endsAt) {
    return apiError(
      c,
      422,
      "ASSIGNMENT_OUT_OF_RANGE",
      "Assignment must be within the activity time"
    )
  }

  const assignmentId = crypto.randomUUID()
  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT INTO shift_assignments
        (id, activity_id, member_id, starts_at, ends_at, notes, status,
         created_by, cancelled_by, cancelled_at, created_at, updated_at)
       SELECT ?, ?, member.id, ?, ?, ?, 'active', ?, NULL, NULL, ?, ?
       FROM members member
       JOIN year_memberships year_membership
         ON year_membership.member_id = member.id
        AND year_membership.year = ?
        AND year_membership.status = 'active'
       WHERE member.id = ?
         AND NOT EXISTS (
           SELECT 1 FROM shift_assignments existing
           WHERE existing.member_id = member.id
             AND existing.status = 'active'
             AND existing.starts_at < ?
             AND existing.ends_at > ?
         )`
    )
    .bind(
      assignmentId,
      activity.id,
      startsAt,
      endsAt,
      parsed.output.notes,
      actor.id,
      now,
      now,
      activity.year,
      parsed.output.memberId,
      endsAt,
      startsAt
    )
    .run()
  if (result.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "MEMBER_OR_TIME_CONFLICT",
      "Member is missing or already assigned during this time"
    )
  }

  const member = await c.env.shift_app
    .prepare("SELECT display_name AS displayName FROM members WHERE id = ?")
    .bind(parsed.output.memberId)
    .first<{ displayName: string }>()
  const availability = await c.env.shift_app
    .prepare(
      `SELECT 1 AS matched
       FROM availability_submissions submission
       JOIN availability_windows window ON window.submission_id = submission.id
       WHERE submission.year = ?
         AND submission.member_id = ?
         AND submission.status = 'submitted'
         AND window.starts_at <= ?
         AND window.ends_at >= ?
       LIMIT 1`
    )
    .bind(activity.year, parsed.output.memberId, startsAt, endsAt)
    .first<{ matched: number }>()

  c.executionCtx.waitUntil(
    notifyAssignmentCreated(c.env, {
      assignmentId,
      memberId: parsed.output.memberId,
      activityName: activity.name,
      place: activity.place,
      startsAt,
    })
  )

  return c.json(
    {
      assignment: assignmentJson({
        id: assignmentId,
        activityId: activity.id,
        memberId: parsed.output.memberId,
        memberDisplayName: member?.displayName ?? "",
        startsAt,
        endsAt,
        notes: parsed.output.notes,
        checkedInAt: null,
      }),
      warnings:
        availability?.matched === 1 ? [] : ["OUTSIDE_SUBMITTED_AVAILABILITY"],
    },
    201
  )
})
