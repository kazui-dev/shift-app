import { canManageYear } from "../../services/role-authority"
import { Hono } from "hono"
import * as v from "valibot"

import { createActivityInputSchema } from "@workspace/shared/shifts"

import {
  serializeActivity,
  type ActivityRow,
} from "../../domain/year-projections"
import {
  apiError,
  type ApiEnv,
  canAccessYear,
  canManageShifts,
  parseYear,
  readJson,
} from "../../lib/http"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearActivitiesApp = new Hono<ApiEnv>()

yearActivitiesApp.get("/:year/activities", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canAccessYear(c.env, c.get("member"), year))) {
    return apiError(c, 403, "FORBIDDEN", "Active year membership is required")
  }
  const canManage = await canManageShifts(c.env, c.get("member"), year)
  const result = await c.env.shift_app
    .prepare(
      `SELECT
         activity.id,
         activity.year,
         activity.name,
         activity.active,
         activity.version,
         activity.place,
         activity.activity_type AS activityType,
         activity.starts_at AS startsAt,
         activity.ends_at AS endsAt,
         activity.color,
         activity.notes,
         (SELECT COUNT(*) FROM shift_assignments assignment JOIN shift_slots slot ON slot.id = assignment.slot_id
          WHERE slot.activity_id = activity.id AND assignment.status = 'active') AS assignmentCount
       FROM activities activity
       WHERE activity.year = ? AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activity.id AND r.member_id=?) OR (activity.created_by=? AND activity.active=0))
       ORDER BY activity.starts_at, activity.ends_at, lower(activity.name)`
    )
    .bind(year, canManage ? 1 : 0, c.get("member").id, c.get("member").id)
    .all<ActivityRow>()
  return c.json({ activities: result.results.map(serializeActivity) })
})

yearActivitiesApp.post("/:year/activities", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const member = c.get("member")
  if (
    !(await canManageShifts(c.env, member, year)) &&
    !(await canManageYear(c.env.shift_app, member, year, "shift.create"))
  ) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  const parsed = v.safeParse(
    createActivityInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_ACTIVITY",
      parsed.issues[0]?.message ?? "Invalid activity"
    )
  }

  const eligible = await c.env.shift_app
    .prepare(
      "SELECT member_id AS id FROM year_memberships WHERE year=? AND status='active'"
    )
    .bind(year)
    .all<{ id: string }>()
  const roles = await c.env.shift_app
    .prepare("SELECT id FROM year_roles WHERE year=?")
    .bind(year)
    .all<{ id: string }>()
  if (
    parsed.output.responsibles.some(
      (target) =>
        !(
          target.targetType === "member" ? eligible.results : roles.results
        ).some((item) => item.id === target.targetId)
    ) ||
    parsed.output.candidateRoleIds.some(
      (roleId) => !roles.results.some((role) => role.id === roleId)
    )
  )
    return apiError(
      c,
      422,
      "INVALID_TARGET",
      "この年度のメンバー・ロールを選択してください"
    )
  const id = crypto.randomUUID()
  const now = Date.now()
  const statement = c.env.shift_app
    .prepare(
      `INSERT INTO activities
        (id, year, name, place, activity_type, starts_at, ends_at, color, notes,
         created_by, updated_by, created_at, updated_at)
       SELECT ?, year, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM operating_years WHERE year = ? RETURNING id`
    )
    .bind(
      id,
      parsed.output.name,
      parsed.output.place,
      parsed.output.activityType,
      Date.parse(parsed.output.startsAt),
      Date.parse(parsed.output.endsAt),
      parsed.output.color,
      parsed.output.notes,
      member.id,
      member.id,
      now,
      now,
      year
    )

  const results = await c.env.shift_app.batch([
    statement,
    ...parsed.output.responsibles.map((target) =>
      c.env.shift_app
        .prepare(
          "INSERT INTO activity_responsibles (activity_id,target_type,target_id) SELECT id,?,? FROM activities WHERE id=?"
        )
        .bind(target.targetType, target.targetId, id)
    ),
    ...parsed.output.candidateRoleIds.map((roleId) =>
      c.env.shift_app
        .prepare(
          "INSERT INTO activity_candidate_roles (activity_id,role_id) SELECT id,? FROM activities WHERE id=?"
        )
        .bind(roleId, id)
    ),
  ])
  const result = results[0]

  if (!result?.results.length) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }

  return c.json(
    {
      activity: serializeActivity({
        id,
        year,
        ...parsed.output,
        active: 0,
        version: 1,
        startsAt: Date.parse(parsed.output.startsAt),
        endsAt: Date.parse(parsed.output.endsAt),
        assignmentCount: 0,
      }),
    },
    201
  )
})
