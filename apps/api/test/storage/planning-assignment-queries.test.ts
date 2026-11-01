import { expect, it } from "vite-plus/test"
import { d1Binding, migrated } from "../support/sqlite"
import { Hono } from "hono"
import * as v from "valibot"
import type { ApiEnv } from "../../src/lib/http"
import { activityPlanningAssignments } from "../../src/features/directory/services/directory-work"
import {
  inputSlotOwners,
  activitiesApp,
} from "../../src/features/activities/routes/activities"
import { yearActivitiesApp } from "../../src/features/activities/routes/years/activities"
import { shiftOverviewApp } from "../../src/features/shifts/routes/overview"
import { otherActivityAssignments } from "../../src/features/activities/services/activity-editor"
import { activityListSelection } from "../../src/features/activities/services/activity-list-query"
import { overviewAssignments } from "../../src/features/attendance/services/planning-attendance"

// Freeze the old projection too: changes to production helpers must not change the oracle.
const previousAssignments = `(SELECT id,slot_id,member_id,status FROM shift_assignments
  UNION ALL SELECT a.id,a.slot_id,s.id,'active' FROM directory_shift_assignments a
  JOIN directory_availability_submissions s ON s.entry_id=a.entry_id
  JOIN student_directory d ON d.id=s.entry_id AND d.status='active')`

// Pre-rewrite queries are the reference for ranges, visibility and UNION ALL multiplicity.
const previousOthers = `SELECT a.member_id AS memberId, s.starts_at AS startsAt, s.ends_at AS endsAt, act.name FROM ${previousAssignments} a JOIN shift_slots s ON s.id = a.slot_id JOIN activities act ON act.id = s.activity_id WHERE a.status = 'active' AND act.id <> ? AND act.year = ?`

const previousList = `SELECT
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
         (SELECT COUNT(*) FROM ${previousAssignments} assignment JOIN shift_slots slot ON slot.id = assignment.slot_id
          WHERE slot.activity_id = activity.id AND assignment.status = 'active') AS assignmentCount
       FROM activities activity
       WHERE activity.year = ? AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=activity.id AND r.member_id=?) OR (activity.created_by=? AND activity.active=0))
       ORDER BY activity.starts_at, activity.ends_at, lower(activity.name)`

const previousOverview = `SELECT p.id,p.slot_id AS slotId,s.activity_id AS activityId,p.member_id AS memberId,s.starts_at AS startsAt,s.ends_at AS endsAt,
      attendance.state,attendance.check_in_status AS checkInStatus,attendance.checked_in_at AS checkedInAt,attendance.expected_at AS expectedAt,attendance.resolved_at AS resolvedAt
      FROM ${previousAssignments} p JOIN shift_slots s ON s.id=p.slot_id JOIN activities a ON a.id=s.activity_id
      LEFT JOIN assignment_attendance attendance ON attendance.assignment_id=p.id
      WHERE a.year=? AND s.starts_at<? AND s.ends_at>? AND p.status='active' AND s.deleted=0
      AND (? OR EXISTS(SELECT 1 FROM activity_effective_responsibles r WHERE r.activity_id=a.id AND r.member_id=?))
      ORDER BY s.starts_at,s.ends_at,p.id`

const day = Date.parse("2026-10-25T00:00:00+09:00")
const hour = 3_600_000
function fixture() {
  const db = migrated()
  db.exec(`INSERT INTO operating_years VALUES (2026,0,0),(2027,0,0);`)
  for (const id of [
    "owner",
    "lead",
    "role-lead",
    "staff",
    "former",
    "manager",
  ]) {
    db.prepare("INSERT INTO user(id,name,email) VALUES (?,?,?)").run(
      id,
      id,
      `${id}@example.test`
    )
    db.prepare("INSERT INTO app_users VALUES (?,?,?,?, 'member',0,0)").run(
      id,
      id,
      id,
      id
    )
    for (const year of [2026, 2027])
      db.prepare(
        "INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES (?,?,'active',0,0)"
      ).run(year, id)
  }
  db.exec(`INSERT INTO year_roles(id,year,name,color,created_at,updated_at) VALUES ('role',2026,'Role','#000',0,0),('outside-role',2027,'Other','#000',0,0),('manager-role',2026,'Manager','#000',0,0);
    INSERT INTO member_year_roles VALUES ('role-lead','role',0),('staff','outside-role',0),('manager','manager-role',0);
    INSERT INTO year_role_permissions VALUES ('manager-role','shift.manage',0);`)
  for (const [id, year, status, submission] of [
    ["entry", 2026, "active", "staff"],
    ["hidden-entry", 2026, "inactive", "hidden-sub"],
    ["outside-entry", 2027, "active", "outside-sub"],
    ["boundary-entry", 2026, "active", "boundary-sub"],
  ] as const) {
    db.prepare(
      "INSERT INTO student_directory(id,year,student_id,display_name,status,created_at) VALUES (?,?,?,?,?,0)"
    ).run(id, year, id, id, status)
    db.prepare(
      "INSERT INTO directory_availability_submissions(id,entry_id,created_at,updated_at) VALUES (?,?,0,0)"
    ).run(submission, id)
  }
  const cases = [
    "present",
    "late",
    "absent",
    "plain",
    "cancelled",
    "deleted",
    "draft",
    "hidden",
    "before",
    "after",
    "overnight",
    "outside",
    "empty",
    "pending",
  ]
  for (const [i, id] of cases.entries()) {
    const year = id === "outside" ? 2027 : 2026
    const from =
      id === "before"
        ? day - hour
        : id === "after"
          ? day + 24 * hour
          : id === "overnight"
            ? day - hour / 2
            : day + (i + 2) * hour
    const to =
      id === "before" ? day : id === "overnight" ? day + hour / 2 : from + hour
    db.prepare(
      `INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,'','shift',?,?,'#000','owner','owner',0,0)`
    ).run(id, year, id, from, to)
    if (id !== "draft") {
      db.prepare(
        "INSERT INTO activity_responsibles VALUES (?, 'member','lead')"
      ).run(id)
      if (year === 2026 && i % 2 === 0)
        db.prepare(
          "INSERT INTO activity_responsibles VALUES (?,'role','role')"
        ).run(id)
      db.prepare("UPDATE activities SET active=1 WHERE id=?").run(id)
    }
    db.prepare(
      "INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES (?,?,?,?)"
    ).run(id, id, from, to)
    if (id === "empty") continue
    const member =
      id === "plain" ? "former" : id === "before" ? "lead" : "staff"
    db.prepare(
      "INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES (?,?,?,?,'owner',0,0)"
    ).run(id, id, member, id === "cancelled" ? "cancelled" : "active")
    // Matching IDs across the sources must retain both rows and the existing attendance join.
    db.prepare(
      "INSERT INTO directory_shift_assignments VALUES (?,?,?,'owner',0,0)"
    ).run(
      id === "present" ? id : `directory-${id}`,
      id,
      year === 2027
        ? "outside-entry"
        : id === "before"
          ? "boundary-entry"
          : "entry"
    )
    // Existing rows linked to an inactive directory must remain invisible too.
    if (id === "hidden")
      db.prepare(
        "UPDATE directory_shift_assignments SET entry_id='hidden-entry' WHERE id=?"
      ).run(`directory-${id}`)
    if (["present", "pending", "late", "absent"].includes(id))
      db.prepare(
        "INSERT INTO assignment_attendance(assignment_id,member_id,state,expected_at,reason,checked_in_at,check_in_status,resolved_at,created_at,updated_at) VALUES (?,?,?,?,'reason',? ,?, ?,0,0)"
      ).run(
        id,
        member,
        id === "pending" ? "present" : id,
        id === "late" ? from + 1000 : null,
        id === "present" || id === "pending" ? from : null,
        id === "present" ? "confirmed" : id === "pending" ? "pending" : null,
        id === "absent" ? from : null
      )
    if (id === "deleted")
      db.prepare("UPDATE shift_slots SET deleted=1 WHERE id=?").run(id)
  }
  // Multiple slots in one activity exercise aggregation and all three sort keys.
  db.prepare(
    "INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES ('extra','present',?,?),('short','present',?,?)"
  ).run(day + 2 * hour, day + 3 * hour, day + 2 * hour, day + 2.5 * hour)
  db.exec(`INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES
    ('z-extra','extra','lead','active','owner',0,0),('short','short','owner','active','owner',0,0);
    INSERT INTO directory_shift_assignments VALUES ('a-extra','extra','boundary-entry','owner',0,0);`)
  db.exec(
    "UPDATE year_memberships SET status='inactive' WHERE member_id='former'"
  )
  return db
}

it("preserves activity-scoped assignment IDs, source multiplicity and all existing filters", () => {
  const db = fixture()
  try {
    const previous = `SELECT a.id,a.slot_id AS slotId,a.member_id AS memberId FROM ${previousAssignments} a JOIN shift_slots s ON s.id=a.slot_id WHERE s.activity_id=? AND a.status='active'`
    for (const id of [
      "present",
      "plain",
      "cancelled",
      "deleted",
      "draft",
      "hidden",
      "outside",
      "empty",
      "missing",
    ]) {
      const ordered = (rows: Record<string, unknown>[]) =>
        rows.map((row) => JSON.stringify(row)).sort()
      expect(
        ordered(db.prepare(activityPlanningAssignments).all(id, id))
      ).toEqual(ordered(db.prepare(previous).all(id)))
    }
    expect(
      db.prepare(activityPlanningAssignments).all("deleted", "deleted")
    ).toHaveLength(2)
    expect(
      db
        .prepare(activityPlanningAssignments)
        .all("plain", "plain")
        .some((row) => row.memberId === "former")
    ).toBe(true)
  } finally {
    db.close()
  }
})

it("looks up only submitted slot owners with the primary key, including deleted and other-year slots", () => {
  const db = fixture()
  try {
    for (const ids of [
      [],
      ["present"],
      ["deleted", "outside", "missing"],
      ["present", "present"],
    ]) {
      const json = JSON.stringify(ids)
      const before = db
        .prepare("SELECT id,activity_id AS activityId FROM shift_slots")
        .all()
        .filter((row) => ids.includes(String(row.id)))
      expect(db.prepare(inputSlotOwners).all(json)).toEqual(before)
      const plan = db
        .prepare(`EXPLAIN QUERY PLAN ${inputSlotOwners}`)
        .all(json)
        .map((row) => String(row.detail))
      expect(
        plan.some((detail) =>
          detail.includes(
            "SEARCH shift_slots USING INDEX sqlite_autoindex_shift_slots_1 (id=?)"
          )
        )
      ).toBe(true)
      expect(plan.some((detail) => detail.startsWith("SCAN shift_slots"))).toBe(
        false
      )
    }
  } finally {
    db.close()
  }
})

it("preserves other-activity assignments including duplicates, inactive memberships, drafts and deleted slots", () => {
  const db = fixture()
  try {
    for (const year of [2026, 2027, 2028])
      for (const excluded of ["present", "outside", "missing"]) {
        const before = db.prepare(previousOthers).all(excluded, year)
        const after = db
          .prepare(otherActivityAssignments)
          .all(excluded, year, excluded, year)
        const ordered = (rows: typeof before) =>
          rows
            .map(({ activityId: _activityId, slotId: _slotId, ...row }) =>
              JSON.stringify(row)
            )
            .sort()
        expect(ordered(after)).toEqual(ordered(before))
      }
    const rows = db
      .prepare(otherActivityAssignments)
      .all("missing", 2026, "missing", 2026)
    expect(
      rows.filter((row) => row.name === "present" && row.memberId === "staff")
    ).toHaveLength(2)
    expect(rows.some((row) => row.memberId === "former")).toBe(true)
    expect(rows.some((row) => row.name === "deleted")).toBe(true)
    expect(rows.some((row) => row.name === "draft")).toBe(true)
    expect(rows.some((row) => row.memberId === "hidden-sub")).toBe(false)
  } finally {
    db.close()
  }
})

it("preserves activity visibility and assignment counts for managers, direct/role responsibles and other actors", () => {
  const db = fixture()
  try {
    for (const year of [2026, 2027, 2028])
      for (const actor of [
        "owner",
        "lead",
        "role-lead",
        "staff",
        "former",
        "missing",
      ])
        for (const manage of [0, 1]) {
          expect(
            db.prepare(activityListSelection).all(year, manage, actor, actor)
          ).toEqual(db.prepare(previousList).all(year, manage, actor, actor))
        }
    const rows = db
      .prepare(activityListSelection)
      .all(2026, 1, "owner", "owner")
    expect(rows.find((row) => row.id === "present")?.assignmentCount).toBe(5)
    expect(rows.find((row) => row.id === "empty")?.assignmentCount).toBe(0)
    expect(rows.find((row) => row.id === "cancelled")?.assignmentCount).toBe(1)
    expect(rows.find((row) => row.id === "deleted")?.assignmentCount).toBe(2)
    expect(rows.find((row) => row.id === "hidden")?.assignmentCount).toBe(1)
  } finally {
    db.close()
  }
})

it("preserves overview visibility, strict day boundaries, ordering, duplicate IDs and every attendance state", () => {
  const db = fixture()
  try {
    for (const year of [2026, 2027, 2028])
      for (const actor of [
        "owner",
        "lead",
        "role-lead",
        "staff",
        "former",
        "missing",
      ])
        for (const manage of [0, 1])
          for (const start of [day, day + 24 * hour]) {
            const params = [year, start + 24 * hour, start, manage, actor]
            expect(
              db.prepare(overviewAssignments).all(...params, ...params)
            ).toEqual(db.prepare(previousOverview).all(...params))
          }
    const params = [2026, day + 24 * hour, day, 1, "owner"]
    const rows = db.prepare(overviewAssignments).all(...params, ...params)
    expect(rows.filter((row) => row.id === "present")).toHaveLength(2)
    expect(
      rows
        .filter((row) => row.id === "present")
        .every((row) => row.checkInStatus === "confirmed")
    ).toBe(true)
    expect(rows.find((row) => row.id === "late")?.state).toBe("late")
    expect(rows.find((row) => row.id === "absent")?.state).toBe("absent")
    expect(rows.find((row) => row.id === "plain")?.state).toBeNull()
    expect(rows.find((row) => row.id === "pending")?.checkInStatus).toBe(
      "pending"
    )
    expect(
      rows.filter((row) => row.activityId === "present").map((row) => row.id)
    ).toEqual(["short", "a-extra", "present", "present", "z-extra"])
    expect(rows.some((row) => row.id === "overnight")).toBe(true)
    for (const id of ["before", "after", "cancelled", "deleted", "outside"])
      expect(rows.some((row) => row.id === id)).toBe(false)
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})

it("searches assignments by slot using the existing indexes in scoped queries", () => {
  const db = fixture()
  try {
    for (const [sql, params] of [
      [otherActivityAssignments, ["present", 2026, "present", 2026]],
      [activityPlanningAssignments, ["present", "present"]],
      [activityListSelection, [2026, 1, "owner", "owner"]],
      [
        overviewAssignments,
        [
          2026,
          day + 24 * hour,
          day,
          1,
          "owner",
          2026,
          day + 24 * hour,
          day,
          1,
          "owner",
        ],
      ],
    ] as const) {
      const details = db
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...params)
        .map((row) => String(row.detail))
      for (const index of [
        "shift_assignments_slot_member_uidx",
        "directory_assignments_slot_entry_uidx",
      ])
        expect(
          details.some(
            (detail) =>
              detail.includes(`SEARCH`) &&
              detail.includes(index) &&
              detail.includes("slot_id=?")
          )
        ).toBe(true)
      expect(
        details.some(
          (detail) =>
            detail.includes("shift_slots_activity_deleted_startsAt_idx") &&
            detail.includes("activity_id=?")
        )
      ).toBe(true)
    }
  } finally {
    db.close()
  }
})

it("keeps both sources scoped through real API bindings and revokes direct, role and management access", async () => {
  const db = fixture()
  try {
    const app = new Hono<ApiEnv>()
    app.use("*", async (c, next) => {
      const id = c.req.header("test-actor") ?? "staff"
      c.set("member", {
        id,
        userId: id,
        displayName: id,
        accessLevel: id === "owner" ? "system_admin" : "member",
      })
      await next()
    })
    app.route("/years", yearActivitiesApp)
    app.route("/years", shiftOverviewApp)
    app.route("/activities", activitiesApp)
    const request = (actor: string, path: string) =>
      app.request(
        `http://localhost${path}`,
        { headers: { "test-actor": actor } },
        { shift_app: d1Binding(db) }
      )
    const listSchema = v.object({
      activities: v.array(
        v.object({ id: v.string(), assignmentCount: v.number() })
      ),
    })
    const editorSchema = v.object({
      otherAssignments: v.array(
        v.object({
          memberId: v.string(),
          startsAt: v.string(),
          endsAt: v.string(),
          name: v.string(),
        })
      ),
    })
    const overviewSchema = v.object({
      canEdit: v.boolean(),
      assignments: v.array(
        v.object({
          id: v.string(),
          slotId: v.string(),
          activityId: v.string(),
          memberId: v.string(),
          startsAt: v.string(),
          endsAt: v.string(),
          attendance: v.nullable(
            v.object({
              state: v.string(),
              checkInStatus: v.nullable(v.string()),
              checkedInAt: v.nullable(v.string()),
              expectedAt: v.nullable(v.string()),
              resolvedAt: v.nullable(v.string()),
            })
          ),
        })
      ),
    })
    const iso = (value: unknown) => {
      if (value === null) return null
      if (typeof value !== "number") throw new Error("Expected a timestamp")
      return new Date(value).toISOString()
    }
    const overviewPath = "/years/2026/shift-overview?date=2026-10-25"
    await Promise.all(
      ["owner", "manager", "lead", "role-lead"].map(async (actor) => {
        const manage = actor === "owner" || actor === "manager" ? 1 : 0
        const list = await request(actor, "/years/2026/activities")
        expect(list.status).toBe(200)
        expect(v.parse(listSchema, await list.json()).activities).toEqual(
          db
            .prepare(previousList)
            .all(2026, manage, actor, actor)
            .map((row) => ({
              id: row.id,
              assignmentCount: row.assignmentCount,
            }))
        )
        const editor = await request(actor, "/activities/present")
        expect(editor.status).toBe(200)
        const actual = v.parse(
          editorSchema,
          await editor.json()
        ).otherAssignments
        const expected = db
          .prepare(previousOthers)
          .all("present", 2026)
          .map((row) => ({
            memberId: row.memberId,
            startsAt: iso(row.startsAt),
            endsAt: iso(row.endsAt),
            name: row.name,
          }))
        expect(actual.map((row) => JSON.stringify(row)).sort()).toEqual(
          expected.map((row) => JSON.stringify(row)).sort()
        )
        const overview = await request(actor, overviewPath)
        expect(overview.status).toBe(200)
        const parsed = v.parse(overviewSchema, await overview.json())
        expect(parsed.canEdit).toBe(!!manage)
        expect(parsed.assignments).toEqual(
          db
            .prepare(previousOverview)
            .all(2026, day + 24 * hour, day, manage, actor)
            .map((row) => ({
              id: row.id,
              slotId: row.slotId,
              activityId: row.activityId,
              memberId: row.memberId,
              startsAt: iso(row.startsAt),
              endsAt: iso(row.endsAt),
              attendance:
                row.state === null
                  ? null
                  : {
                      state: row.state,
                      checkInStatus: row.checkInStatus,
                      checkedInAt: iso(row.checkedInAt),
                      expectedAt: iso(row.expectedAt),
                      resolvedAt: iso(row.resolvedAt),
                    },
            }))
        )
      })
    )
    // An ordinary member's list remains empty, while direct editor/overview access is forbidden.
    const staffList = await request("staff", "/years/2026/activities")
    expect(staffList.status).toBe(200)
    expect(v.parse(listSchema, await staffList.json()).activities).toEqual([])
    expect((await request("staff", "/activities/present")).status).toBe(403)
    expect((await request("staff", overviewPath)).status).toBe(403)
    expect((await request("staff", "/years/2028/activities")).status).toBe(403)
    expect(
      (await request("staff", "/years/2028/shift-overview?date=2026-10-25"))
        .status
    ).toBe(403)
    // Revocation must apply to subsequent requests, including the directory branch.
    for (const actor of ["lead", "role-lead", "manager"]) {
      db.prepare(
        "UPDATE year_memberships SET status='inactive' WHERE year=2026 AND member_id=?"
      ).run(actor)
    }
    await Promise.all(
      ["lead", "role-lead", "manager"].map(async (actor) => {
        expect((await request(actor, "/years/2026/activities")).status).toBe(
          403
        )
        expect((await request(actor, "/activities/present")).status).toBe(403)
        expect((await request(actor, overviewPath)).status).toBe(403)
      })
    )
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})
