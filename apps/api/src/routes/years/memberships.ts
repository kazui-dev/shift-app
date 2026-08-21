import { Hono } from "hono"
import * as v from "valibot"

import {
  apiError,
  type ApiEnv,
  parseYear,
  requireSystemAdmin,
  toIso,
} from "../../lib/http"

const idSchema = v.pipe(v.string(), v.uuid())

type YearStatus = "draft" | "active" | "archived"

function getYearParam(value: string): number | null {
  return parseYear(value)
}

export const yearMembershipsApp = new Hono<ApiEnv>()

yearMembershipsApp.get("/:year/memberships", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const year = getYearParam(c.req.param("year"))
  if (year === null)
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")

  const operatingYear = await c.env.shift_app
    .prepare("SELECT status FROM operating_years WHERE year = ?")
    .bind(year)
    .first<{ status: YearStatus }>()
  if (!operatingYear)
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")

  const result = await c.env.shift_app
    .prepare(
      `SELECT member.id, member.display_name AS displayName, member.student_id AS studentId,
            membership.status, membership.updated_at AS updatedAt
     FROM members member
     LEFT JOIN year_memberships membership
       ON membership.member_id = member.id AND membership.year = ?
     ORDER BY CASE membership.status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END,
              lower(member.display_name)`
    )
    .bind(year)
    .all<{
      id: string
      displayName: string
      studentId: string
      status: "active" | "inactive" | null
      updatedAt: number | null
    }>()

  return c.json({
    memberships: result.results.map((row) => ({
      year,
      member: {
        id: row.id,
        displayName: row.displayName,
        studentId: row.studentId,
      },
      status: row.status,
      updatedAt: row.updatedAt === null ? null : toIso(row.updatedAt),
    })),
  })
})

yearMembershipsApp.put("/:year/memberships/:memberId", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const year = getYearParam(c.req.param("year"))
  const memberId = v.safeParse(idSchema, c.req.param("memberId"))
  if (year === null || !memberId.success)
    return apiError(c, 404, "RESOURCE_NOT_FOUND", "Year or member not found")
  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT INTO year_memberships (year, member_id, status, created_at, updated_at)
     SELECT operating_year.year, member.id, 'active', ?, ?
     FROM operating_years operating_year, members member
     WHERE operating_year.year = ? AND member.id = ?
     ON CONFLICT(year, member_id) DO UPDATE SET status = 'active', updated_at = excluded.updated_at`
    )
    .bind(now, now, year, memberId.output)
    .run()
  if (result.meta.changes !== 1)
    return apiError(c, 404, "RESOURCE_NOT_FOUND", "Year or member not found")
  const member = await c.env.shift_app
    .prepare(
      "SELECT display_name AS displayName, student_id AS studentId FROM members WHERE id = ?"
    )
    .bind(memberId.output)
    .first<{ displayName: string; studentId: string }>()
  return c.json({
    membership: {
      year,
      member: {
        id: memberId.output,
        displayName: member?.displayName ?? "",
        studentId: member?.studentId ?? "",
      },
      status: "active",
      updatedAt: toIso(now),
    },
  })
})

yearMembershipsApp.delete("/:year/memberships/:memberId", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const year = getYearParam(c.req.param("year"))
  const memberId = v.safeParse(idSchema, c.req.param("memberId"))
  if (year === null || !memberId.success)
    return apiError(
      c,
      404,
      "YEAR_MEMBERSHIP_NOT_FOUND",
      "Year membership not found"
    )
  const result = await c.env.shift_app
    .prepare(
      `UPDATE year_memberships SET status = 'inactive', updated_at = ?
     WHERE year = ? AND member_id = ? AND status = 'active'`
    )
    .bind(Date.now(), year, memberId.output)
    .run()
  if (result.meta.changes !== 1)
    return apiError(
      c,
      404,
      "YEAR_MEMBERSHIP_NOT_FOUND",
      "Active year membership not found"
    )
  return c.body(null, 204)
})
