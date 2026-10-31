import { Hono } from "hono"
import * as v from "valibot"

import { apiError, errors } from "../../../lib/errors"
import {
  type ApiEnv,
  parseYear,
  toIso,
  requireSystemAdmin,
} from "../../../lib/http"
import { announce } from "../../../routes/announce"

const idSchema = v.pipe(v.string(), v.uuid())

export const yearMembershipsApp = new Hono<ApiEnv>()
yearMembershipsApp.put(
  "/:year/memberships/:memberId",
  announce({ type: "access_changed" }),
  async (c) => {
    const forbidden = requireSystemAdmin(c)
    if (forbidden) return forbidden
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
      .all()
    if (!result.results.length) return apiError(c, errors.yearMemberNotFound)
    const member = await c.env.shift_app
      .prepare(
        "SELECT m.display_name AS displayName, m.student_id AS studentId, u.image FROM app_users m LEFT JOIN user u ON u.id=m.user_id WHERE m.id = ?"
      )
      .bind(memberId.output)
      .first<{ displayName: string; studentId: string; image: string | null }>()
    if (!member) return apiError(c, errors.yearMemberNotFound)
    return c.json({
      membership: {
        year,
        member: {
          id: memberId.output,
          ...member,
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
    const forbidden = requireSystemAdmin(c)
    if (forbidden) return forbidden
    const year = parseYear(c.req.param("year"))
    const memberId = v.safeParse(idSchema, c.req.param("memberId"))
    if (year === null || !memberId.success)
      return apiError(c, errors.yearMembershipNotFound)
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
      .all()
    if (!result.results.length)
      return apiError(c, errors.yearMembershipNotFound)
    return c.body(null, 204)
  }
)
