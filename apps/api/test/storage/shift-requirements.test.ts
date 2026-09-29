import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import { applyMigration, d1Binding, migrated } from "../support/sqlite"
import { activitiesApp } from "../../src/features/activities/routes/activities"
import { readActivityEditor } from "../../src/features/activities/services/activity-editor"
import { saveShiftPlan } from "../../src/features/shifts/services/save-shift-plan"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { ApiEnv } from "../../src/lib/http"

it("moves known headcounts from empty slots into independent requirements", () => {
  const db = migrated(44)
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Admin','admin@example.test');
      INSERT INTO app_users VALUES ('admin','u','Admin','26AJ002','system_admin',0,0);
      INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
      VALUES ('work',2026,'受付','本館','shift',1000,5000,'#000000','admin','admin',0,0);
      INSERT INTO shift_slots VALUES ('known','work',1000,3000,3,0),('unknown','work',3000,5000,NULL,0);`)
    applyMigration(db, "0044_light_quasar.sql")
    expect(
      db.prepare("SELECT id,required_count FROM shift_requirements").all()
    ).toEqual([{ id: "known", required_count: 3 }])
    expect(
      db.prepare("SELECT id,capacity FROM shift_slots ORDER BY id").all()
    ).toEqual([
      { id: "known", capacity: 3 },
      { id: "unknown", capacity: null },
    ])
  } finally {
    db.close()
  }
})

it("rejects overlapping headcounts during migration", () => {
  const db = migrated(44)
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Admin','admin@example.test');
      INSERT INTO app_users VALUES ('admin','u','Admin','26AJ002','system_admin',0,0);
      INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
      VALUES ('work',2026,'受付','本館','shift',1000,5000,'#000000','admin','admin',0,0);
      INSERT INTO shift_slots VALUES ('first','work',1000,3000,3,0),('second','work',2000,4000,2,0);`)
    expect(() => applyMigration(db, "0044_light_quasar.sql")).toThrow(
      "INVALID_REQUIREMENTS"
    )
  } finally {
    db.close()
  }
})

it("preserves requirements when an older screen omits the field", async () => {
  const db = migrated()
  try {
    const actor = "10000000-0000-4000-8000-000000000001"
    const activity = "20000000-0000-4000-8000-000000000001"
    const requirement = "30000000-0000-4000-8000-000000000001"
    db.prepare("INSERT INTO operating_years VALUES (2026,0,0)").run()
    db.prepare("INSERT INTO user (id,name,email) VALUES (?,?,?)").run(
      actor,
      "Admin",
      "admin@example.test"
    )
    db.prepare("INSERT INTO app_users VALUES (?,?,?,?,?,0,0)").run(
      actor,
      actor,
      "Admin",
      "26AJ002",
      "system_admin"
    )
    db.prepare(`INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
      VALUES (?,2026,'受付','本館','shift',1000,5000,'#000000',?,?,0,0)`).run(
      activity,
      actor,
      actor
    )
    db.prepare("INSERT INTO activity_responsibles VALUES (?,'member',?)").run(
      activity,
      actor
    )
    db.prepare("INSERT INTO shift_requirements VALUES (?,?,?,?,?)").run(
      requirement,
      activity,
      1000,
      3000,
      3
    )
    const binding = d1Binding(db)
    const plan: ActivityEditorInput = {
      name: "更新後",
      place: "本館",
      activityType: "shift",
      startsAt: new Date(1000).toISOString(),
      endsAt: new Date(5000).toISOString(),
      color: "#000000",
      notes: null,
      active: false,
      version: 1,
      candidateRoleIds: [],
      responsibles: [{ targetType: "member", targetId: actor }],
      slots: [],
      requirements: [
        {
          id: requirement,
          startsAt: new Date(1000).toISOString(),
          endsAt: new Date(3000).toISOString(),
          requiredCount: 3,
        },
      ],
    }
    const { requirements, ...legacy } = plan
    expect(requirements).toHaveLength(1)
    const app = new Hono<ApiEnv>()
    app.use("*", async (c, next) => {
      c.set("member", {
        id: actor,
        userId: actor,
        displayName: "Admin",
        accessLevel: "system_admin",
      })
      await next()
    })
    app.route("/activities", activitiesApp)
    const env = {
      shift_app: binding,
      CHAT_DIRECTORY: {
        getByName: () => ({ broadcast: async () => {} }),
      },
    }
    const request = (body: unknown) =>
      app.request(
        `/activities/${activity}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        env,
        { waitUntil() {}, passThroughOnException() {}, props: {} }
      )
    expect((await request(legacy)).status).toBe(200)
    expect(
      db.prepare("SELECT required_count FROM shift_requirements").get()
        ?.required_count
    ).toBe(3)
    expect(
      (await request({ ...plan, version: 2, requirements: [] })).status
    ).toBe(200)
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM shift_requirements").get()?.n
    ).toBe(0)
  } finally {
    db.close()
  }
})

it("saves and replaces requirements without changing work slots", async () => {
  const db = migrated()
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Admin','admin@example.test');
      INSERT INTO app_users VALUES ('admin','u','Admin','26AJ002','system_admin',0,0);
      INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
      VALUES ('work',2026,'受付','本館','shift',1000,5000,'#000000','admin','admin',0,0);
      INSERT INTO shift_slots VALUES ('slot','work',1000,5000,9,0);
      INSERT INTO activity_responsibles VALUES ('work','member','admin');`)
    const app = new Hono<{ Bindings: CloudflareBindings }>()
    app.get("/", async (c) => {
      const binding = c.env.shift_app
      const before = await readActivityEditor(binding, "work")
      if (!before) throw new Error("Missing activity")
      const input: ActivityEditorInput = {
        ...before.activity,
        candidateRoleIds: [],
        responsibles: before.responsibles,
        slots: before.slots,
        requirements: [
          {
            id: "requirement",
            startsAt: new Date(1000).toISOString(),
            endsAt: new Date(3000).toISOString(),
            requiredCount: 3,
          },
        ],
      }
      await saveShiftPlan(binding, "work", "admin", input, before)
      expect(
        db.prepare("SELECT required_count FROM shift_requirements").get()
          ?.required_count
      ).toBe(3)
      expect(
        db.prepare("SELECT capacity FROM shift_slots WHERE id='slot'").get()
          ?.capacity
      ).toBe(9)
      const updated = await readActivityEditor(binding, "work")
      expect(updated?.requirements).toMatchObject([{ requiredCount: 3 }])
      if (!updated) throw new Error("Missing activity")
      await saveShiftPlan(
        binding,
        "work",
        "admin",
        { ...input, version: updated.activity.version, requirements: [] },
        updated
      )
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM shift_requirements").get()?.n
      ).toBe(0)
      expect(
        db.prepare("SELECT capacity FROM shift_slots WHERE id='slot'").get()
          ?.capacity
      ).toBe(9)
      return c.text("ok")
    })
    expect(
      (await app.request("/", {}, { shift_app: d1Binding(db) })).status
    ).toBe(200)
  } finally {
    db.close()
  }
})
