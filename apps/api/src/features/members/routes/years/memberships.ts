import {
  canManageYear,
  roleAuthority,
} from "../../../../auth/authorization/role-authority"
import { Hono } from "hono"
import * as v from "valibot"

import { apiError, errors } from "../../../../lib/errors"
import { type ApiEnv, parseYear, toIso } from "../../../../lib/http"
import { announce } from "../../../../routes/announce"

const idSchema = v.pipe(v.string(), v.uuid())

export const yearMembershipsApp = new Hono<ApiEnv>()
yearMembershipsApp.use("/:year/memberships/*", async (c, next) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) return apiError(c, errors.yearNotFound)
  if (
    !(await canManageYear(
      c.env.shift_app,
      c.get("member"),
      year,
      "member.manage"
    ))
  )
    return apiError(c, errors.memberManagementRequired)
  return next()
})
yearMembershipsApp.use("/:year/memberships", async (c, next) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) return apiError(c, errors.yearNotFound)
  if (
    !(await canManageYear(
      c.env.shift_app,
      c.get("member"),
      year,
      "member.manage"
    ))
  )
    return apiError(c, errors.memberManagementRequired)
  return next()
})

yearMembershipsApp.get("/:year/memberships", async (c) => {
  const year = parseYear(c.req.param("year"))
  if (year === null) return apiError(c, errors.yearNotFound)

  const operatingYear = await c.env.shift_app
    .prepare("SELECT year FROM operating_years WHERE year = ?")
    .bind(year)
    .first<{ year: number }>()
  if (!operatingYear) return apiError(c, errors.yearNotFound)

  const result = await c.env.shift_app
    .prepare(
      `SELECT member.id, identity.image, member.display_name AS displayName, member.student_id AS studentId,
            membership.status, membership.updated_at AS updatedAt
     FROM app_users member
     LEFT JOIN user identity ON identity.id = member.user_id
     LEFT JOIN year_memberships membership
       ON membership.member_id = member.id AND membership.year = ?
     ORDER BY CASE membership.status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END,
              member.student_id`
    )
    .bind(year)
    .all<{
      id: string
      image: string | null
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
        image: row.image,
        studentId: row.studentId,
      },
      status: row.status,
      updatedAt: row.updatedAt === null ? null : toIso(row.updatedAt),
    })),
  })
})

yearMembershipsApp.put(
  "/:year/memberships/:memberId",
  announce({ type: "access_changed" }),
  async (c) => {
    const year = parseYear(c.req.param("year"))
    const memberId = v.safeParse(idSchema, c.req.param("memberId"))
    if (year === null || !memberId.success)
      return apiError(c, errors.yearMemberNotFound)
    const now = Date.now()
    const result = await c.env.shift_app
      .prepare(
        `INSERT INTO year_memberships (year, member_id, status, created_at, updated_at)
     SELECT operating_year.year, member.id, 'active', ?, ?
     FROM operating_years operating_year, app_users member
     WHERE operating_year.year = ? AND member.id = ?
     ON CONFLICT(year, member_id) DO UPDATE SET status = 'active', updated_at = excluded.updated_at RETURNING member_id`
      )
      .bind(now, now, year, memberId.output)
      .run()
    if (!result.results.length) return apiError(c, errors.yearMemberNotFound)
    const member = await c.env.shift_app
      .prepare(
        "SELECT display_name AS displayName, student_id AS studentId FROM app_users WHERE id = ?"
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
  }
)

yearMembershipsApp.delete(
  "/:year/memberships/:memberId",
  announce({ type: "access_changed" }),
  async (c) => {
    const year = parseYear(c.req.param("year"))
    const memberId = v.safeParse(idSchema, c.req.param("memberId"))
    if (year === null || !memberId.success)
      return apiError(c, errors.yearMembershipNotFound)
    const actor = c.get("member")
    const authority = await roleAuthority(c.env.shift_app, actor, year)
    const target = await c.env.shift_app
      .prepare(
        `SELECT m.access_level AS accessLevel,MAX(r.position) AS position FROM app_users m LEFT JOIN member_year_roles mr ON mr.member_id=m.id LEFT JOIN year_roles r ON r.id=mr.role_id AND r.year=? WHERE m.id=? GROUP BY m.id`
      )
      .bind(year, memberId.output)
      .first<{ accessLevel: string; position: number | null }>()
    if (
      !authority.systemAdmin &&
      (!target ||
        target.accessLevel === "system_admin" ||
        (target.position ?? Number.NEGATIVE_INFINITY) >= authority.position)
    )
      return apiError(c, errors.membershipEditForbidden)
    const future = await c.env.shift_app
      .prepare(
        `SELECT 1 FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id JOIN activities activity ON activity.id=s.activity_id WHERE a.member_id=? AND activity.year=? AND a.status='active' AND s.ends_at>? LIMIT 1`
      )
      .bind(memberId.output, year, Date.now())
      .first()
    if (future) return apiError(c, errors.futureShiftsAssigned)
    const result = await c.env.shift_app
      .prepare(
        `UPDATE year_memberships SET status = 'inactive', updated_at = ?
     WHERE year = ? AND member_id = ? AND status = 'active' RETURNING member_id`
      )
      .bind(Date.now(), year, memberId.output)
      .run()
    if (!result.results.length)
      return apiError(c, errors.yearMembershipNotFound)
    return c.body(null, 204)
  }
)
