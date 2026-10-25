import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import * as v from "valibot"
import {
  activityEditorResponseSchema,
  type ActivityEditorInput,
} from "@workspace/shared/shifts"
import { activitiesApp } from "../../src/features/activities/routes/activities"
import type { ApiEnv } from "../../src/lib/http"
import { d1Binding, migrated } from "../support/sqlite"

const uuid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const owner = uuid(1),
  lead = uuid(2),
  staff = uuid(3),
  activity = uuid(10),
  other = uuid(11),
  peer = uuid(12)
const ownSlot = uuid(20),
  deletedSlot = uuid(21),
  foreignSlot = uuid(22),
  foreignDeletedSlot = uuid(23),
  newSlot = uuid(24),
  peerSlot = uuid(25),
  peerDeletedSlot = uuid(26)
const assignment = uuid(30),
  directoryAssignment = uuid(31),
  submission = uuid(40)
const errorSchema = v.object({
  error: v.object({ code: v.string(), message: v.string() }),
})

function fixture(
  hooks: { beforeBatch?: (db: ReturnType<typeof migrated>) => void } = {}
) {
  const db = migrated()
  db.exec("INSERT INTO operating_years VALUES (2026,0,0),(2027,0,0)")
  for (const [id, name] of [
    [owner, "Admin"],
    [lead, "Lead"],
    [staff, "Staff"],
  ]) {
    if (!id || !name) throw new Error("Invalid fixture member")
    db.prepare("INSERT INTO user(id,name,email) VALUES (?,?,?)").run(
      id,
      name,
      `${name}@example.test`
    )
    db.prepare("INSERT INTO app_users VALUES (?,?,?,?,?,0,0)").run(
      id,
      id,
      name,
      name,
      id === owner ? "system_admin" : "member"
    )
    db.prepare(
      "INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES (2026,?,'active',0,0)"
    ).run(id)
  }
  for (const [id, year] of [
    [activity, 2026],
    [other, 2027],
    [peer, 2026],
  ] as const)
    db.prepare(
      "INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES (?,?,'Work','','shift',1000,5000,'#000000',?,?,0,0)"
    ).run(id, year, owner, owner)
  db.prepare("INSERT INTO activity_responsibles VALUES (?,'member',?)").run(
    activity,
    lead
  )
  for (const [id, activityId, deleted] of [
    [ownSlot, activity, 0],
    [deletedSlot, activity, 1],
    [foreignSlot, other, 0],
    [foreignDeletedSlot, other, 1],
    [peerSlot, peer, 0],
    [peerDeletedSlot, peer, 1],
  ] as const)
    db.prepare("INSERT INTO shift_slots VALUES (?,?,1000,5000,NULL,?)").run(
      id,
      activityId,
      deleted
    )
  db.prepare(
    "INSERT INTO shift_assignments(id,slot_id,member_id,created_by,created_at,updated_at) VALUES (?,?,?,?,0,0)"
  ).run(assignment, ownSlot, owner, owner)
  db.prepare(
    "INSERT INTO assignment_attendance(assignment_id,member_id,state,checked_in_at,check_in_status,created_at,updated_at) VALUES (?,?,'present',1000,'confirmed',0,0)"
  ).run(assignment, owner)
  db.exec(
    "INSERT INTO student_directory(id,year,student_id,display_name,created_at) VALUES ('entry',2026,'Directory','Directory',0)"
  )
  db.prepare(
    "INSERT INTO directory_availability_submissions(id,entry_id,created_at,updated_at) VALUES (?,'entry',0,0)"
  ).run(submission)
  db.prepare(
    "INSERT INTO directory_shift_assignments VALUES (?,?,'entry',?,0,0)"
  ).run(directoryAssignment, ownSlot, owner)
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    const id = c.req.header("test-actor") ?? owner
    c.set("member", {
      id,
      userId: id,
      displayName: id,
      accessLevel: id === owner ? "system_admin" : "member",
    })
    await next()
  })
  app.route("/activities", activitiesApp)
  const binding = d1Binding(db, { beforeBatch: () => hooks.beforeBatch?.(db) })
  const env = {
    shift_app: binding,
    CHAT_DIRECTORY: { getByName: () => ({ broadcast: async () => {} }) },
  }
  const plan: ActivityEditorInput = {
    name: "Saved",
    place: "",
    activityType: "shift",
    startsAt: new Date(1000).toISOString(),
    endsAt: new Date(5000).toISOString(),
    color: "#000000",
    notes: null,
    active: false,
    version: 1,
    candidateRoleIds: [],
    responsibles: [{ targetType: "member", targetId: lead }],
    requirements: [],
    slots: [
      {
        id: ownSlot,
        startsAt: new Date(1000).toISOString(),
        endsAt: new Date(5000).toISOString(),
        capacity: null,
        memberIds: [owner, submission],
      },
    ],
  }
  const request = (body: unknown, actor = owner) =>
    app.request(
      `/activities/${activity}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", "test-actor": actor },
        body: JSON.stringify(body),
      },
      env,
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    )
  const stored = () => ({
    activities: db.prepare("SELECT * FROM activities ORDER BY id").all(),
    slots: db.prepare("SELECT * FROM shift_slots ORDER BY id").all(),
    assignments: db
      .prepare("SELECT * FROM shift_assignments ORDER BY id")
      .all(),
    directory: db
      .prepare("SELECT * FROM directory_shift_assignments ORDER BY id")
      .all(),
    attendance: db.prepare("SELECT * FROM assignment_attendance").all(),
    history: db.prepare("SELECT * FROM activity_history").all(),
  })
  return { db, plan, request, stored }
}

it("keeps registered/directory assignment IDs and attendance through an authorized responsible's save", async () => {
  const { db, plan, request } = fixture()
  try {
    const response = await request(plan, lead)
    expect(response.status).toBe(200)
    const result = v.parse(activityEditorResponseSchema, await response.json())
    expect(result.slots[0]?.memberIds.toSorted()).toEqual(
      [owner, submission].toSorted()
    )
    expect(result.activity.version).toBe(2)
    expect(db.prepare("SELECT id,status FROM shift_assignments").all()).toEqual(
      [{ id: assignment, status: "active" }]
    )
    expect(
      db.prepare("SELECT id FROM directory_shift_assignments").all()
    ).toEqual([{ id: directoryAssignment }])
    expect(
      db
        .prepare(
          "SELECT assignment_id,state,check_in_status FROM assignment_attendance"
        )
        .all()
    ).toEqual([
      {
        assignment_id: assignment,
        state: "present",
        check_in_status: "confirmed",
      },
    ])
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})

it.each([newSlot, deletedSlot])(
  "accepts a new or own deleted slot without changing the owner (%s)",
  async (id) => {
    const { db, plan, request } = fixture()
    try {
      const response = await request({
        ...plan,
        slots: plan.slots.map((slot) => ({ ...slot, id, memberIds: [] })),
      })
      expect(response.status).toBe(200)
      expect(
        db
          .prepare("SELECT activity_id,deleted FROM shift_slots WHERE id=?")
          .get(id)
      ).toEqual({ activity_id: activity, deleted: 0 })
      expect(
        db
          .prepare("SELECT status FROM shift_assignments WHERE id=?")
          .get(assignment)?.status
      ).toBe("cancelled")
    } finally {
      db.close()
    }
  }
)

it.each([foreignSlot, foreignDeletedSlot, peerSlot, peerDeletedSlot])(
  "rejects another activity's active or deleted slot among valid slots with INVALID_SLOT and no writes (%s)",
  async (id) => {
    const { db, plan, request, stored } = fixture()
    try {
      const before = stored()
      const response = await request({
        ...plan,
        slots: [
          ...plan.slots,
          ...plan.slots.map((slot) => ({ ...slot, id, memberIds: [] })),
        ],
      })
      expect(response.status).toBe(409)
      expect(v.parse(errorSchema, await response.json()).error).toEqual({
        code: "INVALID_SLOT",
        message: "別のシフトの枠です。",
      })
      expect(stored()).toEqual(before)
    } finally {
      db.close()
    }
  }
)

it("preserves permission and stale-version error precedence before slot ownership checks", async () => {
  const { db, plan, request, stored } = fixture()
  try {
    db.prepare("UPDATE activities SET version=2 WHERE id=?").run(activity)
    const before = stored()
    const body = {
      ...plan,
      version: 1,
      slots: plan.slots.map((slot) => ({ ...slot, id: foreignSlot })),
    }
    const forbidden = await request(body, staff)
    expect(forbidden.status).toBe(403)
    const stale = await request(body)
    expect(stale.status).toBe(409)
    expect(v.parse(errorSchema, await stale.json()).error.code).toBe(
      "SHIFT_CHANGED"
    )
    expect(stored()).toEqual(before)
  } finally {
    db.close()
  }
})

it("rolls back a slot ownership race detected by the existing transactional guard", async () => {
  const { db, plan, request, stored } = fixture({
    beforeBatch: (database) => {
      database
        .prepare("INSERT INTO shift_slots VALUES (?,?,1000,5000,NULL,0)")
        .run(newSlot, other)
    },
  })
  try {
    const before = stored()
    const response = await request({
      ...plan,
      slots: plan.slots.map((slot) => ({
        ...slot,
        id: newSlot,
        memberIds: [],
      })),
    })
    expect(response.status).toBe(409)
    expect(v.parse(errorSchema, await response.json()).error.code).toBe(
      "SHIFT_CHANGED"
    )
    const after = stored()
    expect({
      ...after,
      slots: after.slots.filter((slot) => slot.id !== newSlot),
    }).toEqual(before)
    expect(
      db.prepare("SELECT activity_id FROM shift_slots WHERE id=?").get(newSlot)
        ?.activity_id
    ).toBe(other)
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})

it("clears every allocation with an empty slot list while retaining attendance and history", async () => {
  const { db, plan, request } = fixture()
  try {
    const response = await request({ ...plan, slots: [] }, lead)
    expect(response.status).toBe(200)
    const result = v.parse(activityEditorResponseSchema, await response.json())
    expect(result.slots).toEqual([])
    expect(result.activity.version).toBe(2)
    expect(db.prepare("SELECT id,status FROM shift_assignments").all()).toEqual(
      [{ id: assignment, status: "cancelled" }]
    )
    expect(
      db.prepare("SELECT id FROM directory_shift_assignments").all()
    ).toEqual([])
    expect(
      db
        .prepare("SELECT deleted FROM shift_slots WHERE activity_id=?")
        .all(activity)
        .every((row) => row.deleted === 1)
    ).toBe(true)
    expect(
      db
        .prepare(
          "SELECT assignment_id,state,check_in_status FROM assignment_attendance"
        )
        .all()
    ).toEqual([
      {
        assignment_id: assignment,
        state: "present",
        check_in_status: "confirmed",
      },
    ])
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM activity_history WHERE activity_id=?"
        )
        .get(activity)?.n
    ).toBe(1)
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})

it("rejects a version changed after reads without overwriting concurrent work", async () => {
  const { db, plan, request, stored } = fixture({
    beforeBatch: (database) => {
      database
        .prepare(
          "UPDATE activities SET version=version+1,name='Concurrent' WHERE id=?"
        )
        .run(activity)
    },
  })
  try {
    const before = stored()
    const response = await request(plan, lead)
    expect(response.status).toBe(409)
    expect(v.parse(errorSchema, await response.json()).error.code).toBe(
      "SHIFT_CHANGED"
    )
    expect(stored()).toEqual({
      ...before,
      activities: before.activities.map((row) =>
        row.id === activity ? { ...row, version: 2, name: "Concurrent" } : row
      ),
    })
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})
