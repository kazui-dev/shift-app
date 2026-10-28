import { Hono } from "hono"
import * as v from "valibot"
import { attendanceSettingsSchema } from "@workspace/shared/shifts"
import { canManageYear } from "../../../auth/authorization/role-authority"
import { apiError, errors } from "../../../lib/errors"
import { type ApiEnv, parseYear, readJson } from "../../../lib/http"
import { announce } from "../../../routes/announce"

export const attendanceSettingsApp = new Hono<ApiEnv>()
attendanceSettingsApp.use("/:year/attendance-settings", async (c, next) => {
  const year = parseYear(c.req.param("year") ?? "")
  if (year === null) return apiError(c, errors.yearNotFound)
  if (
    !(await canManageYear(
      c.env.shift_app,
      c.get("member"),
      year,
      "shift.manage"
    ))
  )
    return apiError(c, errors.shiftManagementRequired)
  if (
    !(await c.env.shift_app
      .prepare("SELECT year FROM operating_years WHERE year=?")
      .bind(year)
      .first())
  )
    return apiError(c, errors.yearNotFound)
  return next()
})
attendanceSettingsApp.get("/:year/attendance-settings", async (c) => {
  const db = c.env.shift_app,
    year = parseYear(c.req.param("year"))
  const [settings, roles, members] = await Promise.all([
    db
      .prepare(
        "SELECT notice_audience AS noticeAudience FROM year_attendance_settings WHERE year=?"
      )
      .bind(year)
      .first<{ noticeAudience: string }>(),
    db
      .prepare(
        "SELECT allowed.role_id AS id FROM attendance_notice_roles allowed JOIN year_roles role ON role.id=allowed.role_id AND role.year=allowed.year WHERE allowed.year=? ORDER BY allowed.role_id"
      )
      .bind(year)
      .all<{ id: string }>(),
    db
      .prepare(
        "SELECT allowed.member_id AS id FROM attendance_notice_members allowed JOIN year_memberships active ON active.year=allowed.year AND active.member_id=allowed.member_id AND active.status='active' WHERE allowed.year=? ORDER BY allowed.member_id"
      )
      .bind(year)
      .all<{ id: string }>(),
  ])
  return c.json({
    noticeAudience: settings?.noticeAudience ?? "selected",
    roleIds: roles.results.map((row) => row.id),
    memberIds: members.results.map((row) => row.id),
  })
})
attendanceSettingsApp.put(
  "/:year/attendance-settings",
  announce({ type: "access_changed" }),
  async (c) => {
    const input = v.safeParse(
      attendanceSettingsSchema,
      await readJson(c.req.raw)
    )
    if (!input.success) return apiError(c, errors.invalidAttendanceSettings)
    const db = c.env.shift_app,
      year = parseYear(c.req.param("year")),
      settings = input.output
    const [roles, members] = await Promise.all([
      db
        .prepare(
          "SELECT id FROM year_roles WHERE year=? AND id IN (SELECT value FROM json_each(?))"
        )
        .bind(year, JSON.stringify(settings.roleIds))
        .all(),
      db
        .prepare(
          "SELECT member_id FROM year_memberships WHERE year=? AND status='active' AND member_id IN (SELECT value FROM json_each(?))"
        )
        .bind(year, JSON.stringify(settings.memberIds))
        .all(),
    ])
    if (
      roles.results.length !== settings.roleIds.length ||
      members.results.length !== settings.memberIds.length
    )
      return apiError(c, errors.invalidAttendanceSettings)
    await db.batch([
      db
        .prepare(
          "INSERT INTO year_attendance_settings(year,notice_audience) VALUES(?,?) ON CONFLICT(year) DO UPDATE SET notice_audience=excluded.notice_audience"
        )
        .bind(year, settings.noticeAudience),
      db.prepare("DELETE FROM attendance_notice_roles WHERE year=?").bind(year),
      db
        .prepare("DELETE FROM attendance_notice_members WHERE year=?")
        .bind(year),
      db
        .prepare(
          "INSERT INTO attendance_notice_roles(year,role_id) SELECT ?,value FROM json_each(?)"
        )
        .bind(year, JSON.stringify(settings.roleIds)),
      db
        .prepare(
          "INSERT INTO attendance_notice_members(year,member_id) SELECT ?,value FROM json_each(?)"
        )
        .bind(year, JSON.stringify(settings.memberIds)),
    ])
    return c.body(null, 204)
  }
)
