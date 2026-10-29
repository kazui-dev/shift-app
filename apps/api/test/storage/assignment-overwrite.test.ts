import { Hono } from "hono"
import * as v from "valibot"
import { expect, it } from "vite-plus/test"
import {
  assignmentOverwriteReviewSchema,
  type ActivityEditorInput,
} from "@workspace/shared/shifts"
import { activitiesApp } from "../../src/features/activities/routes/activities"
import type { ApiEnv } from "../../src/lib/http"
import { d1Binding, migrated } from "../support/sqlite"

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const actor = uuid(1),
  member = uuid(2),
  other = uuid(3),
  target = uuid(10),
  old = uuid(11),
  original = uuid(20),
  empty = uuid(21),
  assignment = uuid(30),
  entry = uuid(40),
  survey = uuid(41)
const at = (hour: number) => new Date(Date.UTC(2026, 10, 1, hour)).toISOString()
const ms = (hour: number) => Date.parse(at(hour))
function fixture(directory = false) {
  const db = migrated()
  db.exec("INSERT INTO operating_years VALUES (2026,0,0)")
  for (const id of [actor, member, other]) {
    db.prepare("INSERT INTO user(id,name,email) VALUES (?,?,?)").run(
      id,
      id,
      `${id}@example.test`
    )
    db.prepare("INSERT INTO app_users VALUES (?,?,?,?,'member',0,0)").run(
      id,
      id,
      id,
      id
    )
    db.prepare(
      "INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES (2026,?,'active',0,0)"
    ).run(id)
  }
  for (const id of [target, old]) {
    db.prepare(
      "INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES (?,2026,?,'','shift',?,?,'#000000',?,?,0,0)"
    ).run(id, id, ms(8), ms(18), actor, actor)
    db.prepare("INSERT INTO activity_responsibles VALUES (?,'member',?)").run(
      id,
      actor
    )
    db.prepare("UPDATE activities SET active=1 WHERE id=?").run(id)
  }
  db.prepare(
    "INSERT INTO shift_slots VALUES (?,?,?, ?,3,0),(?,?,?, ?,NULL,0)"
  ).run(original, old, ms(9), ms(12), empty, old, ms(15), ms(16))
  if (directory) {
    db.prepare(
      "INSERT INTO student_directory(id,year,student_id,display_name,status,created_at) VALUES (?,2026,'directory','Directory','active',0)"
    ).run(entry)
    db.prepare(
      "INSERT INTO directory_availability_submissions(id,entry_id,created_at,updated_at) VALUES (?,?,0,0)"
    ).run(survey, entry)
    db.prepare(
      "INSERT INTO directory_shift_assignments VALUES (?,?,?, ?,0,0)"
    ).run(assignment, original, entry, actor)
  } else {
    db.prepare(
      "INSERT INTO shift_assignments(id,slot_id,member_id,notes,status,created_by,created_at,updated_at) VALUES (?,?,?,'keep note','active',?,0,0)"
    ).run(assignment, original, member, actor)
  }
  db.prepare(
    "INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES (?,?,?,'active',?,0,0)"
  ).run(uuid(31), original, other, actor)
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    c.set("member", {
      id: actor,
      userId: actor,
      displayName: "Admin",
      accessLevel: c.req.header("test-member") ? "member" : "system_admin",
    })
    await next()
  })
  app.route("/activities", activitiesApp)
  const request = (
    path: string,
    body: unknown,
    options: {
      method?: string
      member?: boolean
      beforeBatch?: (() => void) | undefined
    } = {}
  ) =>
    app.request(
      `http://localhost/activities/${target}${path}`,
      {
        method: options.method ?? "POST",
        headers: {
          "content-type": "application/json",
          ...(options.member ? { "test-member": "true" } : {}),
        },
        body: JSON.stringify(body),
      },
      {
        shift_app: d1Binding(
          db,
          options.beforeBatch ? { beforeBatch: options.beforeBatch } : {}
        ),
        CHAT_DIRECTORY: {
          getByName: () => ({ broadcast: () => Promise.resolve() }),
        },
      },
      { waitUntil: () => {}, passThroughOnException: () => {}, props: {} }
    )
  const plan: ActivityEditorInput = {
    name: "new",
    place: "",
    activityType: "shift",
    startsAt: at(8),
    endsAt: at(18),
    color: "#000000",
    notes: null,
    active: true,
    version: 1,
    candidateRoleIds: [],
    responsibles: [{ targetType: "member", targetId: actor }],
    requirements: [],
    slots: [
      {
        id: uuid(22),
        startsAt: at(10),
        endsAt: at(11),
        capacity: null,
        memberIds: [directory ? survey : member],
      },
    ],
  }
  const review = async () => {
    const response = await request("/overlap-review", plan)
    expect(response.status).toBe(200)
    return v.parse(assignmentOverwriteReviewSchema, await response.json())
  }
  return { db, request, plan, review }
}

it.each([false, true])(
  "reviews without writing, then atomically splits an old allocation (directory=%s)",
  async (directory) => {
    const { db, request, plan, review } = fixture(directory)
    try {
      expect((await request("", plan, { method: "PUT" })).status).toBe(409)
      const confirmation = await review()
      expect(confirmation.changes).toHaveLength(1)
      expect(confirmation.changes[0]?.remaining).toEqual([
        { startsAt: at(9), endsAt: at(10) },
        { startsAt: at(11), endsAt: at(12) },
      ])
      expect(
        db.prepare("SELECT version FROM activities WHERE id=?").get(old)
          ?.version
      ).toBe(1)
      const response = await request(
        "/overwrite",
        { plan, token: confirmation.token },
        { method: "PUT" }
      )
      expect(await response.clone().text()).not.toContain('"error"')
      expect(response.status).toBe(200)
      const sql = directory
        ? "SELECT a.id,s.starts_at,s.ends_at FROM directory_shift_assignments a JOIN shift_slots s ON s.id=a.slot_id WHERE s.activity_id=? AND a.entry_id=? ORDER BY s.starts_at"
        : "SELECT a.id,s.starts_at,s.ends_at,a.notes FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id WHERE s.activity_id=? AND a.member_id=? AND a.status='active' ORDER BY s.starts_at"
      const rows = db.prepare(sql).all(old, directory ? entry : member)
      expect(rows.map((row) => [row.starts_at, row.ends_at])).toEqual([
        [ms(9), ms(10)],
        [ms(11), ms(12)],
      ])
      expect(rows[0]?.id).toBe(assignment)
      expect(rows.every((row) => directory || row.notes === "keep note")).toBe(
        true
      )
      expect(
        db
          .prepare("SELECT slot_id FROM shift_assignments WHERE id=?")
          .get(uuid(31))?.slot_id
      ).toBe(original)
      expect(
        db.prepare("SELECT deleted FROM shift_slots WHERE id=?").get(empty)
          ?.deleted
      ).toBe(0)
      expect(
        db
          .prepare("SELECT version FROM activities ORDER BY id")
          .all()
          .map((row) => row.version)
      ).toEqual([2, 2])
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM activity_history").get()?.n
      ).toBe(2)
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
    } finally {
      db.close()
    }
  }
)

it.each([
  [8, 10, [[10, 12]]],
  [11, 13, [[9, 11]]],
  [8, 13, []],
  [12, 13, [[9, 12]]],
])("retains only unaffected time for %s–%s", async (from, to, expected) => {
  const { db, request, plan, review } = fixture()
  try {
    plan.slots = [
      {
        id: uuid(22),
        startsAt: at(from),
        endsAt: at(to),
        capacity: null,
        memberIds: [member],
      },
    ]
    const confirmation = await review()
    expect(confirmation.changes).toHaveLength(from === 12 ? 0 : 1)
    expect(
      (
        await request(
          "/overwrite",
          { plan, token: confirmation.token },
          { method: "PUT" }
        )
      ).status
    ).toBe(200)
    expect(
      db
        .prepare(
          "SELECT s.starts_at,s.ends_at FROM shift_assignments a JOIN shift_slots s ON s.id=a.slot_id WHERE s.activity_id=? AND a.member_id=? AND a.status='active' ORDER BY s.starts_at"
        )
        .all(old, member)
        .map((row) => [row.starts_at, row.ends_at])
    ).toEqual(expected.map(([a = 0, b = 0]) => [ms(a), ms(b)]))
  } finally {
    db.close()
  }
})

it.each(["permission"])("blocks protected assignments: %s", async (kind) => {
  const { db, request, plan } = fixture()
  try {
    if (kind === "permission")
      db.prepare("DELETE FROM activity_responsibles WHERE activity_id=?").run(
        old
      )
    const response = await request("/overlap-review", plan, { member: true })
    expect(response.status).toBe(200)
    const confirmation = v.parse(
      assignmentOverwriteReviewSchema,
      await response.json()
    )
    expect(confirmation.changes[0]?.blockedReason).toBeTruthy()
    expect(
      (
        await request(
          "/overwrite",
          { plan, token: confirmation.token },
          { method: "PUT", member: true }
        )
      ).status
    ).toBe(409)
    expect(
      db.prepare("SELECT version FROM activities WHERE id=?").get(target)
        ?.version
    ).toBe(1)
  } finally {
    db.close()
  }
})

it.each(["token", "stale", "race", "target-race"])(
  "rejects changed confirmations and rolls back all overwrite writes: %s",
  async (kind) => {
    const { db, request, plan, review } = fixture()
    try {
      const confirmation = await review()
      if (kind === "stale")
        db.prepare("UPDATE activities SET version=2 WHERE id=?").run(old)
      const response = await request(
        "/overwrite",
        { plan, token: kind === "token" ? "0".repeat(64) : confirmation.token },
        {
          method: "PUT",
          beforeBatch: kind.endsWith("race")
            ? () => {
                db.prepare("UPDATE activities SET version=2 WHERE id=?").run(
                  kind === "target-race" ? target : old
                )
              }
            : undefined,
        }
      )
      expect(response.status).toBe(409)
      expect(
        db
          .prepare("SELECT slot_id,status FROM shift_assignments WHERE id=?")
          .get(assignment)
      ).toEqual({ slot_id: original, status: "active" })
      expect(
        db
          .prepare("SELECT COUNT(*) AS n FROM shift_slots WHERE activity_id=?")
          .get(target)?.n
      ).toBe(0)
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM activity_history").get()?.n
      ).toBe(0)
    } finally {
      db.close()
    }
  }
)

it("requires authorization and continues rejecting overlaps within the submitted shift", async () => {
  const { db, request, plan } = fixture()
  try {
    plan.slots.push({
      ...plan.slots[0],
      id: uuid(23),
      startsAt: at(10),
      endsAt: at(11),
      capacity: null,
      memberIds: [member],
    })
    expect((await request("/overlap-review", plan)).status).toBe(409)
    db.prepare("DELETE FROM activity_responsibles WHERE activity_id=?").run(
      target
    )
    expect(
      (await request("/overlap-review", plan, { member: true })).status
    ).toBe(403)
    expect(
      (
        await request(
          "/overwrite",
          { plan, token: "0".repeat(64) },
          { method: "PUT", member: true }
        )
      ).status
    ).toBe(403)
  } finally {
    db.close()
  }
})

it.each([false, true])(
  "preserves attendance and its history while overwriting (full=%s)",
  async (full) => {
    const { db, request, plan, review } = fixture()
    try {
      if (full)
        plan.slots = [
          {
            id: uuid(22),
            startsAt: at(9),
            endsAt: at(12),
            capacity: null,
            memberIds: [member],
          },
        ]
      const confirmation = await review()
      const response = await request(
        "/overwrite",
        { plan, token: confirmation.token },
        {
          method: "PUT",
          beforeBatch: () => {
            db.prepare(
              "INSERT INTO assignment_attendance(assignment_id,member_id,state,checked_in_at,check_in_status,created_at,updated_at) VALUES (?,?,'present',?,'confirmed',0,0)"
            ).run(assignment, member, ms(9))
            db.prepare(
              "INSERT INTO assignment_attendance_events(id,assignment_id,actor_id,action,created_at) VALUES (?,?,?,'check_in',0)"
            ).run(uuid(50), assignment, actor)
          },
        }
      )
      expect(response.status).toBe(200)
      expect(
        db
          .prepare(
            "SELECT state,checked_in_at FROM assignment_attendance WHERE assignment_id=?"
          )
          .get(assignment)
      ).toEqual({ state: "present", checked_in_at: ms(9) })
      expect(
        db
          .prepare(
            "SELECT assignment_id FROM assignment_attendance_events WHERE id=?"
          )
          .get(uuid(50))?.assignment_id
      ).toBe(assignment)
      expect(
        db
          .prepare("SELECT status FROM shift_assignments WHERE id=?")
          .get(assignment)?.status
      ).toBe(full ? "cancelled" : "active")
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM assignment_attendance att JOIN shift_assignments a ON a.id=att.assignment_id JOIN shift_slots s ON s.id=a.slot_id WHERE s.activity_id=?"
          )
          .get(target)?.n
      ).toBe(0)
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
    } finally {
      db.close()
    }
  }
)

it.each([199, 200])(
  "counts removed original slots when enforcing the 200-slot limit (%s existing)",
  async (count) => {
    const { db, request, plan, review } = fixture()
    try {
      db.prepare("DELETE FROM shift_assignments WHERE id=?").run(uuid(31))
      for (let index = 2; index < count; index++)
        db.prepare(
          "INSERT INTO shift_slots(id,activity_id,starts_at,ends_at,deleted) VALUES (?,?,?,?,0)"
        ).run(uuid(100 + index), old, ms(15), ms(16))
      const confirmation = await review()
      expect(confirmation.changes[0]?.blockedReason === null).toBe(
        count === 199
      )
      expect(
        (
          await request(
            "/overwrite",
            { plan, token: confirmation.token },
            { method: "PUT" }
          )
        ).status
      ).toBe(count === 199 ? 200 : 409)
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM shift_slots WHERE activity_id=? AND deleted=0"
          )
          .get(old)?.n
      ).toBe(200)
    } finally {
      db.close()
    }
  }
)
