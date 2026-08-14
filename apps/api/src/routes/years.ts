import { Hono } from "hono"

import {
  createActivityInputSchema,
  createOperatingYearInputSchema,
  createYearRoleInputSchema,
  replaceAvailabilityInputSchema,
  updateOperatingYearInputSchema,
} from "@workspace/shared/shifts"

import {
  apiError,
  type ApiEnv,
  canManageShifts,
  parseYear,
  readJson,
  requireSystemAdmin,
  toIso,
} from "../http"

type YearRow = {
  year: number
  name: string
  startsOn: string
  endsOn: string
  status: "draft" | "active" | "archived"
}

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
  assignmentCount: number
}

type AvailabilityRow = {
  id: string
  status: "draft" | "submitted"
  submittedAt: number | null
  updatedAt: number
}

type AvailabilityManagerRow = {
  submissionId: string
  memberId: string
  displayName: string
  studentId: string
  status: "draft" | "submitted"
  submittedAt: number | null
  windowId: string | null
  startsAt: number | null
  endsAt: number | null
}

function getYearParam(value: string): number | null {
  return parseYear(value)
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
    assignmentCount: activity.assignmentCount,
  }
}

export const yearsApp = new Hono<ApiEnv>()

yearsApp.get("/", async (c) => {
  const result = await c.env.shift_app
    .prepare(
      `SELECT year, name, starts_on AS startsOn, ends_on AS endsOn, status
       FROM operating_years
       ORDER BY year DESC`
    )
    .all<YearRow>()
  return c.json({ years: result.results })
})

yearsApp.post("/", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied

  const parsed = createOperatingYearInputSchema.safeParse(
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_YEAR",
      parsed.error.issues[0]?.message ?? "Invalid year"
    )
  }

  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT OR IGNORE INTO operating_years
        (year, name, starts_on, ends_on, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      parsed.data.year,
      parsed.data.name,
      parsed.data.startsOn,
      parsed.data.endsOn,
      parsed.data.status,
      now,
      now
    )
    .run()

  if (result.meta.changes !== 1) {
    return apiError(c, 409, "YEAR_EXISTS", "Operating year already exists")
  }
  return c.json({ year: parsed.data }, 201)
})

yearsApp.patch("/:year", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied

  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const input = updateOperatingYearInputSchema.safeParse(
    await readJson(c.req.raw)
  )
  if (!input.success) {
    return apiError(
      c,
      422,
      "INVALID_YEAR",
      input.error.issues[0]?.message ?? "Invalid year"
    )
  }

  const current = await c.env.shift_app
    .prepare(
      `SELECT year, name, starts_on AS startsOn, ends_on AS endsOn, status
       FROM operating_years WHERE year = ?`
    )
    .bind(year)
    .first<YearRow>()
  if (!current) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }

  const merged = createOperatingYearInputSchema.safeParse({
    ...current,
    ...input.data,
  })
  if (!merged.success) {
    return apiError(
      c,
      422,
      "INVALID_YEAR",
      merged.error.issues[0]?.message ?? "Invalid year"
    )
  }

  await c.env.shift_app
    .prepare(
      `UPDATE operating_years
       SET name = ?, starts_on = ?, ends_on = ?, status = ?, updated_at = ?
       WHERE year = ?`
    )
    .bind(
      merged.data.name,
      merged.data.startsOn,
      merged.data.endsOn,
      merged.data.status,
      Date.now(),
      year
    )
    .run()
  return c.json({ year: merged.data })
})

yearsApp.get("/:year/roles", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }

  const roles = await c.env.shift_app
    .prepare(
      `SELECT
         role.id,
         role.name,
         role.color,
         GROUP_CONCAT(permission.permission) AS permissions,
         (SELECT COUNT(*) FROM member_year_roles membership WHERE membership.role_id = role.id) AS memberCount
       FROM year_roles role
       LEFT JOIN year_role_permissions permission ON permission.role_id = role.id
       WHERE role.year = ?
       GROUP BY role.id
       ORDER BY lower(role.name)`
    )
    .bind(year)
    .all<{
      id: string
      name: string
      color: string
      permissions: string | null
      memberCount: number
    }>()

  return c.json({
    roles: roles.results.map((role) => ({
      ...role,
      year,
      permissions: role.permissions?.split(",") ?? [],
    })),
  })
})

yearsApp.post("/:year/roles", async (c) => {
  const denied = requireSystemAdmin(c)
  if (denied) return denied
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const parsed = createYearRoleInputSchema.safeParse(await readJson(c.req.raw))
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_ROLE",
      parsed.error.issues[0]?.message ?? "Invalid role"
    )
  }

  const roleId = crypto.randomUUID()
  const now = Date.now()
  const statements = [
    c.env.shift_app
      .prepare(
        `INSERT OR IGNORE INTO year_roles
          (id, year, name, color, created_at, updated_at)
         SELECT ?, year, ?, ?, ?, ? FROM operating_years WHERE year = ?`
      )
      .bind(roleId, parsed.data.name, parsed.data.color, now, now, year),
    ...parsed.data.permissions.map((permission) =>
      c.env.shift_app
        .prepare(
          `INSERT INTO year_role_permissions (role_id, permission, created_at)
           SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM year_roles WHERE id = ?)`
        )
        .bind(roleId, permission, now, roleId)
    ),
  ]
  const results = await c.env.shift_app.batch(statements)
  if (results[0]?.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "ROLE_CONFLICT",
      "Year is missing or role name already exists"
    )
  }

  return c.json({ role: { id: roleId, year, ...parsed.data } }, 201)
})

yearsApp.get("/:year/members", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canManageShifts(c.env, c.get("member"), year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }

  const members = await c.env.shift_app
    .prepare(
      `SELECT
         member.id,
         member.display_name AS displayName,
         member.student_id AS studentId,
         role.id AS roleId,
         role.name AS roleName,
         role.color AS roleColor
       FROM members member
       LEFT JOIN member_year_roles membership ON membership.member_id = member.id
       LEFT JOIN year_roles role ON role.id = membership.role_id AND role.year = ?
       WHERE EXISTS (SELECT 1 FROM operating_years WHERE year = ?)
       ORDER BY lower(member.display_name), lower(role.name)`
    )
    .bind(year, year)
    .all<{
      id: string
      displayName: string
      studentId: string
      roleId: string | null
      roleName: string | null
      roleColor: string | null
    }>()

  const byId = new Map<
    string,
    {
      id: string
      displayName: string
      studentId: string
      roles: Array<{ id: string; name: string; color: string }>
    }
  >()
  for (const row of members.results) {
    const member = byId.get(row.id) ?? {
      id: row.id,
      displayName: row.displayName,
      studentId: row.studentId,
      roles: [],
    }
    if (row.roleId && row.roleName && row.roleColor) {
      member.roles.push({
        id: row.roleId,
        name: row.roleName,
        color: row.roleColor,
      })
    }
    byId.set(row.id, member)
  }

  return c.json({ members: [...byId.values()] })
})

yearsApp.get("/:year/activities", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const result = await c.env.shift_app
    .prepare(
      `SELECT
         activity.id,
         activity.year,
         activity.name,
         activity.place,
         activity.activity_type AS activityType,
         activity.starts_at AS startsAt,
         activity.ends_at AS endsAt,
         activity.color,
         activity.notes,
         (SELECT COUNT(*) FROM shift_assignments assignment
          WHERE assignment.activity_id = activity.id AND assignment.status = 'active') AS assignmentCount
       FROM activities activity
       WHERE activity.year = ?
       ORDER BY activity.starts_at, lower(activity.name)`
    )
    .bind(year)
    .all<ActivityRow>()
  return c.json({ activities: result.results.map(activityJson) })
})

yearsApp.post("/:year/activities", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const member = c.get("member")
  if (!(await canManageShifts(c.env, member, year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  const parsed = createActivityInputSchema.safeParse(await readJson(c.req.raw))
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_ACTIVITY",
      parsed.error.issues[0]?.message ?? "Invalid activity"
    )
  }

  const id = crypto.randomUUID()
  const now = Date.now()
  const result = await c.env.shift_app
    .prepare(
      `INSERT INTO activities
        (id, year, name, place, activity_type, starts_at, ends_at, color, notes,
         created_by, updated_by, created_at, updated_at)
       SELECT ?, year, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM operating_years WHERE year = ? AND status <> 'archived'`
    )
    .bind(
      id,
      parsed.data.name,
      parsed.data.place,
      parsed.data.activityType,
      Date.parse(parsed.data.startsAt),
      Date.parse(parsed.data.endsAt),
      parsed.data.color,
      parsed.data.notes,
      member.id,
      member.id,
      now,
      now,
      year
    )
    .run()
  if (result.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "YEAR_NOT_EDITABLE",
      "Operating year is archived or missing"
    )
  }

  return c.json(
    {
      activity: activityJson({
        id,
        year,
        ...parsed.data,
        startsAt: Date.parse(parsed.data.startsAt),
        endsAt: Date.parse(parsed.data.endsAt),
        assignmentCount: 0,
      }),
    },
    201
  )
})

yearsApp.get("/:year/availability", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const member = c.get("member")
  const submission = await c.env.shift_app
    .prepare(
      `SELECT id, status, submitted_at AS submittedAt, updated_at AS updatedAt
       FROM availability_submissions WHERE year = ? AND member_id = ?`
    )
    .bind(year, member.id)
    .first<AvailabilityRow>()
  if (!submission) {
    return c.json({
      availability: {
        year,
        status: "draft" as const,
        submittedAt: null,
        windows: [],
      },
    })
  }

  const windows = await c.env.shift_app
    .prepare(
      `SELECT id, starts_at AS startsAt, ends_at AS endsAt
       FROM availability_windows WHERE submission_id = ? ORDER BY starts_at`
    )
    .bind(submission.id)
    .all<{ id: string; startsAt: number; endsAt: number }>()
  return c.json({
    availability: {
      year,
      status: submission.status,
      submittedAt: submission.submittedAt
        ? toIso(submission.submittedAt)
        : null,
      updatedAt: toIso(submission.updatedAt),
      windows: windows.results.map((window) => ({
        id: window.id,
        startsAt: toIso(window.startsAt),
        endsAt: toIso(window.endsAt),
      })),
    },
  })
})

yearsApp.put("/:year/availability", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  const parsed = replaceAvailabilityInputSchema.safeParse(
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(
      c,
      422,
      "INVALID_AVAILABILITY",
      parsed.error.issues[0]?.message ?? "Invalid availability"
    )
  }
  const member = c.get("member")
  const submissionId = crypto.randomUUID()
  const now = Date.now()
  const submittedAt = parsed.data.status === "submitted" ? now : null
  const statements = [
    c.env.shift_app
      .prepare(
        `INSERT INTO availability_submissions
          (id, year, member_id, status, submitted_at, created_at, updated_at)
         SELECT ?, year, ?, ?, ?, ?, ? FROM operating_years
         WHERE year = ? AND status = 'active'
         ON CONFLICT(year, member_id) DO UPDATE SET
           status = excluded.status,
           submitted_at = excluded.submitted_at,
           updated_at = excluded.updated_at`
      )
      .bind(
        submissionId,
        member.id,
        parsed.data.status,
        submittedAt,
        now,
        now,
        year
      ),
    c.env.shift_app
      .prepare(
        `DELETE FROM availability_windows
         WHERE submission_id = (
           SELECT submission.id FROM availability_submissions submission
           JOIN operating_years operating_year ON operating_year.year = submission.year
           WHERE submission.year = ? AND submission.member_id = ? AND operating_year.status = 'active'
         )`
      )
      .bind(year, member.id),
    ...parsed.data.windows.map((window) =>
      c.env.shift_app
        .prepare(
          `INSERT INTO availability_windows
            (id, submission_id, starts_at, ends_at, created_at)
           SELECT ?, submission.id, ?, ?, ?
           FROM availability_submissions submission
           JOIN operating_years operating_year ON operating_year.year = submission.year
           WHERE submission.year = ? AND submission.member_id = ? AND operating_year.status = 'active'`
        )
        .bind(
          crypto.randomUUID(),
          Date.parse(window.startsAt),
          Date.parse(window.endsAt),
          now,
          year,
          member.id
        )
    ),
  ]
  const results = await c.env.shift_app.batch(statements)
  if (results[0]?.meta.changes !== 1) {
    return apiError(
      c,
      409,
      "YEAR_NOT_ACTIVE",
      "Availability can only be edited for an active year"
    )
  }
  return c.json({
    availability: {
      year,
      status: parsed.data.status,
      submittedAt: submittedAt ? toIso(submittedAt) : null,
      windows: parsed.data.windows,
    },
  })
})

yearsApp.get("/:year/availability-submissions", async (c) => {
  const year = getYearParam(c.req.param("year"))
  if (year === null) {
    return apiError(c, 404, "YEAR_NOT_FOUND", "Operating year not found")
  }
  if (!(await canManageShifts(c.env, c.get("member"), year))) {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "Shift management permission is required"
    )
  }
  const rows = await c.env.shift_app
    .prepare(
      `SELECT
         submission.id AS submissionId,
         member.id AS memberId,
         member.display_name AS displayName,
         member.student_id AS studentId,
         submission.status,
         submission.submitted_at AS submittedAt,
         window.id AS windowId,
         window.starts_at AS startsAt,
         window.ends_at AS endsAt
       FROM availability_submissions submission
       JOIN members member ON member.id = submission.member_id
       LEFT JOIN availability_windows window ON window.submission_id = submission.id
       WHERE submission.year = ?
       ORDER BY lower(member.display_name), window.starts_at`
    )
    .bind(year)
    .all<AvailabilityManagerRow>()

  const submissions = new Map<
    string,
    {
      id: string
      member: { id: string; displayName: string; studentId: string }
      status: "draft" | "submitted"
      submittedAt: string | null
      windows: Array<{ id: string; startsAt: string; endsAt: string }>
    }
  >()
  for (const row of rows.results) {
    const current = submissions.get(row.submissionId) ?? {
      id: row.submissionId,
      member: {
        id: row.memberId,
        displayName: row.displayName,
        studentId: row.studentId,
      },
      status: row.status,
      submittedAt: row.submittedAt ? toIso(row.submittedAt) : null,
      windows: [],
    }
    if (row.windowId && row.startsAt !== null && row.endsAt !== null) {
      current.windows.push({
        id: row.windowId,
        startsAt: toIso(row.startsAt),
        endsAt: toIso(row.endsAt),
      })
    }
    submissions.set(row.submissionId, current)
  }
  return c.json({ submissions: [...submissions.values()] })
})
