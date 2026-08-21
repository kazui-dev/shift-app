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

  const targets = await c.env.shift_app
    .prepare(
      `SELECT member.id AS targetId, member.display_name AS displayName
       FROM year_memberships membership
       JOIN members member ON member.id = membership.member_id
       WHERE membership.year = ? AND membership.status = 'active'
       ORDER BY lower(member.display_name), member.id`
    )
    .bind(year)
    .all<{ targetId: string; displayName: string }>()

  return c.json({
    targets: targets.results.map(
      (target) =>
        ({
          targetType: "member",
          ...target,
        }) satisfies ChatTargetOption
    ),
  })
})
