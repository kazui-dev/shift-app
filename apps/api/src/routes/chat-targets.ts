import { Hono } from "hono"

import type { ChatTargetOption } from "@workspace/shared/communications"

import {
  apiError,
  type ApiEnv,
  hasActiveYearMembership,
  parseYear,
} from "../lib/http"

export const chatTargetsApp = new Hono<ApiEnv>()

chatTargetsApp.get("/targets", async (c) => {
  const year = parseYear(c.req.query("year") ?? "")
  if (year === null) {
    return apiError(c, 422, "INVALID_CHAT_TARGET_QUERY", "Invalid chat year")
  }

  const member = c.get("member")
  if (!(await hasActiveYearMembership(c.env, member.id, year))) {
    return apiError(
      c,
      403,
      "YEAR_MEMBERSHIP_REQUIRED",
      "Active year membership is required"
    )
  }

  const members = await c.env.shift_app
    .prepare(
      `SELECT member.id AS targetId, member.display_name AS displayName, identity.image
       FROM year_memberships membership
       JOIN app_users member ON member.id = membership.member_id
       LEFT JOIN user identity ON identity.id = member.user_id
       WHERE membership.year = ? AND membership.status = 'active'
       ORDER BY lower(member.display_name), member.id`
    )
    .bind(year)
    .all<{ targetId: string; displayName: string; image: string | null }>()

  const [roleMembers, shiftMembers] = await Promise.all([
    c.env.shift_app
      .prepare(`SELECT mr.member_id AS memberId, mr.role_id AS targetId
      FROM member_year_roles mr JOIN year_roles r ON r.id = mr.role_id WHERE r.year = ?`)
      .bind(year)
      .all<{ memberId: string; targetId: string }>(),
    c.env.shift_app
      .prepare(`SELECT DISTINCT sa.member_id AS memberId, s.activity_id AS targetId
      FROM shift_assignments sa JOIN shift_slots s ON s.id = sa.slot_id
      JOIN activities a ON a.id = s.activity_id
      WHERE a.year = ? AND a.active = 1 AND s.deleted = 0 AND sa.status = 'active'`)
      .bind(year)
      .all<{ memberId: string; targetId: string }>(),
  ])
  const targets: ChatTargetOption[] = members.results.map(
    (target) =>
      ({
        targetType: "member",
        ...target,
        roleIds: roleMembers.results
          .filter((row) => row.memberId === target.targetId)
          .map((row) => row.targetId),
        activityIds: shiftMembers.results
          .filter((row) => row.memberId === target.targetId)
          .map((row) => row.targetId),
      }) satisfies ChatTargetOption
  )

  const [roles, activities] = await Promise.all([
    c.env.shift_app
      .prepare(
        `SELECT id AS targetId, name AS displayName
           FROM year_roles
           WHERE year = ?
           ORDER BY lower(name), id`
      )
      .bind(year)
      .all<{ targetId: string; displayName: string }>(),
    c.env.shift_app
      .prepare(
        `SELECT id AS targetId, name AS displayName
           FROM activities
           WHERE year = ? AND active = 1
           ORDER BY starts_at, lower(name), id`
      )
      .bind(year)
      .all<{ targetId: string; displayName: string }>(),
  ])
  targets.push(
    ...roles.results.map(
      (target) => ({ targetType: "role", ...target }) satisfies ChatTargetOption
    ),
    ...activities.results.map(
      (target) =>
        ({ targetType: "activity", ...target }) satisfies ChatTargetOption
    )
  )

  return c.json({ targets })
})
