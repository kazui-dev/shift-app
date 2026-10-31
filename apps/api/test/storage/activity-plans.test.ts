import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import * as v from "valibot"
import {
  activityPlansResponseSchema,
  type ActivityEditorInput,
} from "@workspace/shared/shifts"
import { activitiesApp } from "../../src/features/activities/routes/activities"
import type { ApiEnv } from "../../src/lib/http"
import { d1Binding, migrated } from "../support/sqlite"

const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const owner = id(1),
  lead = id(2),
  source = id(10),
  target = id(11),
  slot = id(20),
  targetSlot = id(21),
  assignment = id(30),
  submission = id(40)
function fixture(beforeBatch?: (db: ReturnType<typeof migrated>) => void) {
  const db = migrated(),
    start = Date.now() + 3600_000,
    end = start + 3600_000
  db.exec("INSERT INTO operating_years VALUES(2026,0,0)")
  for (const member of [owner, lead]) {
    db.prepare("INSERT INTO user(id,name,email) VALUES(?,?,?)").run(
      member,
      member,
      `${member}@example.test`
    )
    db.prepare("INSERT INTO app_users VALUES(?,?,?,?,?,0,0)").run(
      member,
      member,
      member,
      member,
      member === owner ? "system_admin" : "member"
    )
    db.prepare(
      "INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES(2026,?,'active',0,0)"
    ).run(member)
  }
  for (const activity of [source, target]) {
    db.prepare(
      "INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES(?,2026,'Work','','shift',?,?,'#000000',?,?,0,0)"
    ).run(activity, start, end, owner, owner)
    db.prepare("INSERT INTO activity_responsibles VALUES(?,'member',?)").run(
      activity,
      activity === source ? lead : owner
    )
  }
  db.prepare("INSERT INTO shift_slots VALUES(?,?,?,?,NULL,0)").run(
    slot,
    source,
    start,
    end
  )
  db.prepare(
    "INSERT INTO shift_assignments(id,slot_id,member_id,created_by,created_at,updated_at) VALUES(?,?,?,?,0,0)"
  ).run(assignment, slot, owner, owner)
  db.exec(
    "INSERT INTO student_directory(id,year,student_id,display_name,created_at) VALUES('entry',2026,'Directory','Directory',0)"
  )
  db.prepare(
    "INSERT INTO directory_availability_submissions(id,entry_id,created_at,updated_at) VALUES(?,'entry',0,0)"
  ).run(submission)
  db.prepare(
    "INSERT INTO directory_shift_assignments VALUES(?,?,'entry',?,0,0)"
  ).run(id(31), slot, owner)
  const plan: ActivityEditorInput = {
    name: "Work",
    place: "",
    activityType: "shift",
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    color: "#000000",
    notes: null,
    active: false,
    version: 1,
    candidateRoleIds: [],
    responsibles: [{ targetType: "member", targetId: owner }],
    requirements: [],
    slots: [],
  }
  const plans = [
    { id: source, plan },
    {
      id: target,
      plan: {
        ...plan,
        slots: [
          {
            id: targetSlot,
            startsAt: plan.startsAt,
            endsAt: plan.endsAt,
            capacity: null,
            memberIds: [owner, submission],
          },
        ],
      },
    },
  ]
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    const actor = c.req.header("test-actor") ?? owner
    c.set("member", {
      id: actor,
      userId: actor,
      displayName: actor,
      accessLevel: actor === owner ? "system_admin" : "member",
    })
    await next()
  })
  app.route("/activities", activitiesApp)
  const env = {
    shift_app: d1Binding(db, { beforeBatch: () => beforeBatch?.(db) }),
    CHAT_DIRECTORY: { getByName: () => ({ broadcast: async () => {} }) },
  }
  const request = (value = plans, actor = owner) =>
    app.request(
      "/activities/plans",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", "test-actor": actor },
        body: JSON.stringify({ plans: value }),
      },
      env,
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    )
  const assignments = () => ({
    registered: db
      .prepare("SELECT id,slot_id,status FROM shift_assignments ORDER BY id")
      .all(),
    directory: db
      .prepare("SELECT * FROM directory_shift_assignments ORDER BY id")
      .all(),
    versions: db.prepare("SELECT id,version FROM activities ORDER BY id").all(),
    history: db.prepare("SELECT * FROM activity_history ORDER BY id").all(),
  })
  return { db, plans, request, assignments }
}

it.each([false, true])(
  "moves registered and directory assignments atomically in either input order (reverse=%s)",
  async (reverse) => {
    const { db, plans, request } = fixture()
    try {
      const response = await request(reverse ? plans.toReversed() : plans)
      expect(response.status).toBe(200)
      const result = v.parse(activityPlansResponseSchema, await response.json())
      expect(
        result.activities.find((a) => a.activity.id === source)?.slots
      ).toEqual([])
      expect(
        result.activities
          .find((a) => a.activity.id === target)
          ?.slots[0]?.memberIds.toSorted()
      ).toEqual([owner, submission].toSorted())
      expect(
        db
          .prepare(
            "SELECT slot_id FROM shift_assignments WHERE status='active'"
          )
          .all()
      ).toEqual([{ slot_id: targetSlot }])
      expect(
        db.prepare("SELECT slot_id FROM directory_shift_assignments").all()
      ).toEqual([{ slot_id: targetSlot }])
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
    } finally {
      db.close()
    }
  }
)

function record(db: ReturnType<typeof migrated>, history = false) {
  if (history)
    db.prepare(
      "INSERT INTO assignment_attendance_events(id,assignment_id,actor_id,action,created_at) VALUES(?,?,?,'check_in',0)"
    ).run(id(50), assignment, owner)
  else
    db.prepare(
      "INSERT INTO assignment_attendance(assignment_id,member_id,state,checked_in_at,check_in_status,created_at,updated_at) VALUES(?,?,'present',1,'confirmed',0,0)"
    ).run(assignment, owner)
}

it("rolls back the source removal when the destination conflicts with a third shift", async () => {
  const { db, plans, request, assignments } = fixture()
  try {
    const destination = plans[1]
    if (!destination) throw new Error("fixture")
    const start = Date.parse(destination.plan.endsAt) + 3600_000,
      end = start + 3600_000
    db.prepare(
      "INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES(?,2026,'Third','','shift',?,?,'#000000',?,?,0,0)"
    ).run(id(12), start, end, owner, owner)
    db.prepare("INSERT INTO shift_slots VALUES(?,?,?,?,NULL,0)").run(
      id(22),
      id(12),
      start,
      end
    )
    db.prepare(
      "INSERT INTO shift_assignments(id,slot_id,member_id,created_by,created_at,updated_at) VALUES(?,?,?,?,0,0)"
    ).run(id(32), id(22), owner, owner)
    const later = {
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    }
    const before = assignments()
    const response = await request(
      plans.map((item) =>
        item.id === target
          ? {
              ...item,
              plan: {
                ...item.plan,
                ...later,
                slots: item.plan.slots.map((s) => ({ ...s, ...later })),
              },
            }
          : item
      )
    )
    expect(response.status).toBe(409)
    expect(assignments()).toEqual(before)
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})
it.each(["ended", "recorded", "history", "permission", "stale"])(
  "rejects %s without changing either plan",
  async (reason) => {
    const { db, plans, request, assignments } = fixture()
    try {
      if (reason === "ended")
        db.prepare(
          "UPDATE shift_slots SET starts_at=0,ends_at=1 WHERE id=?"
        ).run(slot)
      if (reason === "recorded" || reason === "history")
        record(db, reason === "history")
      if (reason === "stale")
        db.prepare("UPDATE activities SET version=2 WHERE id=?").run(target)
      const before = assignments()
      const response = await request(
        plans,
        reason === "permission" ? lead : owner
      )
      expect(response.status).toBe(reason === "permission" ? 403 : 409)
      expect(assignments()).toEqual(before)
    } finally {
      db.close()
    }
  }
)
it.each(["attendance", "version"])(
  "rolls back both plans when %s changes after validation",
  async (reason) => {
    const { db, request, assignments } = fixture((database) => {
      if (reason === "attendance") record(database, true)
      if (reason === "version")
        database
          .prepare("UPDATE activities SET version=2 WHERE id=?")
          .run(target)
    })
    try {
      const before = assignments()
      const response = await request()
      expect(response.status).toBe(409)
      expect(
        db
          .prepare("SELECT id,slot_id,status FROM shift_assignments WHERE id=?")
          .all(assignment)
      ).toEqual(before.registered)
      expect(
        db
          .prepare("SELECT * FROM directory_shift_assignments ORDER BY id")
          .all()
      ).toEqual(before.directory)
      expect(db.prepare("SELECT * FROM activity_history").all()).toEqual([])
    } finally {
      db.close()
    }
  }
)
