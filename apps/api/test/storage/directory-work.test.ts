import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import { applyMigration, d1Binding, migrated } from "../support/sqlite"
import { directoryWork } from "../support/directory-work"
import { readActivityEditor } from "../../src/features/activities/services/activity-editor"
import { saveShiftPlan } from "../../src/features/shifts/services/save-shift-plan"
import {
  planningMembers,
  planningSubmissions,
} from "../../src/features/directory/services/directory-work"
import type { ActivityEditorInput } from "@workspace/shared/shifts"

it("keeps existing directory answers when adding listing status", () => {
  const db = migrated(42)
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO student_directory (id,year,student_id,display_name,created_at) VALUES ('entry',2026,'26AJ001','Participant',0);`)
    directoryWork(db, "entry")
    applyMigration(db, "0042_directory_status.sql")
    expect(
      db.prepare("SELECT status FROM student_directory").get()?.status
    ).toBe("active")
    expect(
      db.prepare("SELECT choice FROM directory_availability_day_answers").get()
        ?.choice
    ).toBe("all")
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})

it("excludes an inactive directory listing while retaining its answers", async () => {
  const db = migrated()
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Admin','admin@example.test');
      INSERT INTO app_users VALUES ('admin','u','Admin','26AJ002','system_admin',0,0);
      INSERT INTO student_directory (id,year,student_id,display_name,created_at) VALUES ('entry',2026,'26AJ001','Participant',0);
      INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
      VALUES ('work',2026,'受付','本館','shift',1793403000000,1793444400000,'#000000','admin','admin',0,0);
      INSERT INTO shift_slots VALUES ('slot','work',1793403000000,1793444400000,2,0);`)
    directoryWork(db, "entry")
    expect(
      db.prepare(`SELECT id FROM ${planningMembers} WHERE year=2026`).all()
    ).toEqual([{ id: "admin" }, { id: "submission" }])

    db.exec(
      "INSERT INTO directory_shift_assignments VALUES ('existing','slot','entry','admin',0,0)"
    )
    expect(() =>
      db.exec("UPDATE student_directory SET status='inactive' WHERE id='entry'")
    ).toThrow(/DIRECTORY_ASSIGNMENTS_EXIST/)
    db.exec("DELETE FROM directory_shift_assignments WHERE id='existing'")
    db.exec("UPDATE student_directory SET status='inactive' WHERE id='entry'")
    expect(
      db.prepare(`SELECT id FROM ${planningMembers} WHERE year=2026`).all()
    ).toEqual([{ id: "admin" }])
    expect(
      db.prepare(`SELECT id FROM ${planningSubmissions} WHERE year=2026`).all()
    ).toEqual([])
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM directory_availability_day_answers")
        .get()?.n
    ).toBe(1)
    expect(() =>
      db.exec(
        "INSERT INTO directory_shift_assignments VALUES ('assignment','slot','entry','admin',0,0)"
      )
    ).toThrow(/YEAR_MEMBERSHIP_REQUIRED/)

    db.exec(
      "INSERT INTO user (id,name,email) VALUES ('future','Participant','future@example.test')"
    )
    expect(() =>
      db.exec(
        "INSERT INTO app_users VALUES ('future-member','future','Participant','26AJ001','member',0,0)"
      )
    ).toThrow(/DIRECTORY_INACTIVE/)
    db.exec(`INSERT INTO operating_years VALUES (2027,0,0);
      UPDATE year_settings SET default_year=2027 WHERE id=1;
      INSERT INTO app_users VALUES ('future-member','future','Participant','26AJ001','member',0,0);`)
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM availability_submissions").get()?.n
    ).toBe(0)
    expect(
      db
        .prepare(
          "SELECT year FROM year_memberships WHERE member_id='future-member'"
        )
        .all()
    ).toEqual([{ year: 2027 }])
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM directory_availability_day_answers")
        .get()?.n
    ).toBe(1)
  } finally {
    db.close()
  }
})

it("saves directory allocations and transfers them when a real member is created", async () => {
  const db = migrated()
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Admin','admin@example.test');
      INSERT INTO app_users VALUES ('admin','u','Admin','26AJ002','system_admin',0,0);
      INSERT INTO student_directory (id,year,student_id,display_name,created_at) VALUES ('entry',2026,'26AJ001','Participant',0);
      INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
      VALUES ('work',2026,'受付','本館','shift',1793403000000,1793444400000,'#000000','admin','admin',0,0);
      INSERT INTO shift_slots VALUES ('slot','work',1793403000000,1793444400000,2,0);`)
    directoryWork(db, "entry")
    db.exec(
      `INSERT INTO directory_shift_assignments VALUES ('assignment','slot','entry','admin',0,0);`
    )
    const app = new Hono<{ Bindings: CloudflareBindings }>()
    app.get("/", async (c) => {
      const binding = c.env.shift_app
      const before = await readActivityEditor(binding, "work")
      expect(before).toMatchObject({
        members: [{ id: "submission" }, { id: "admin" }],
        slots: [{ memberIds: ["submission"] }],
        submittedMemberIds: ["submission"],
      })
      expect(db.prepare("SELECT id FROM app_users").all()).toEqual([
        { id: "admin" },
      ])
      expect(() =>
        db.exec(
          `INSERT INTO app_users (id,display_name,student_id,created_at,updated_at) VALUES ('bad','Bad','26AJ003',0,0)`
        )
      ).toThrow(/NOT NULL/)
      if (!before) throw new Error("Missing activity")
      const input: ActivityEditorInput = {
        ...before.activity,
        notes: "",
        candidateRoleIds: [],
        responsibles: [{ targetType: "member", targetId: "admin" }],
        slots: before.slots,
      }
      await saveShiftPlan(binding, "work", "admin", input, before)
      expect(
        db.prepare("SELECT id,entry_id FROM directory_shift_assignments").all()
      ).toEqual([{ id: "assignment", entry_id: "entry" }])
      expect(
        db.prepare("SELECT COUNT(*) AS n FROM shift_assignments").get()?.n
      ).toBe(0)
      db.exec(`INSERT INTO user (id,name,email) VALUES ('new-user','Participant','participant@example.test');
      INSERT INTO app_users VALUES ('new-member','new-user','Participant','26AJ001','member',0,0);`)
      expect(
        db.prepare("SELECT id,member_id FROM shift_assignments").all()
      ).toEqual([{ id: "assignment", member_id: "new-member" }])
      expect(
        db.prepare("SELECT member_id FROM availability_submissions").get()
          ?.member_id
      ).toBe("new-member")
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM directory_availability_submissions"
          )
          .get()?.n
      ).toBe(0)
      expect(
        db
          .prepare("SELECT COUNT(*) AS n FROM directory_shift_assignments")
          .get()?.n
      ).toBe(0)
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
      await expect(
        saveShiftPlan(
          binding,
          "work",
          "admin",
          { ...input, version: input.version + 1 },
          before
        )
      ).rejects.toThrow(/activity_history.before/)
      return c.text("ok")
    })
    const result = await app.request("/", {}, { shift_app: d1Binding(db) })
    expect(await result.text()).toBe("ok")
  } finally {
    db.close()
  }
})

it("rejects cross-year and overlapping directory assignments without creating members", () => {
  const db = migrated()
  try {
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0),(2027,0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Admin','admin@example.test');
      INSERT INTO app_users VALUES ('admin','u','Admin','26AJ002','system_admin',0,0);
      INSERT INTO student_directory (id,year,student_id,display_name,created_at) VALUES ('entry',2026,'26AJ001','Participant',0);
      INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at)
      VALUES ('work',2026,'受付','本館','shift',1000,5000,'#000000','admin','admin',0,0),('other',2027,'受付','本館','shift',1000,5000,'#000000','admin','admin',0,0);
      INSERT INTO shift_slots VALUES ('slot','work',1000,3000,2,0),('overlap','work',2000,4000,2,0),('cross-year','other',3000,4000,2,0);`)
    directoryWork(db, "entry")
    db.exec(
      `INSERT INTO directory_shift_assignments VALUES ('a','slot','entry','admin',0,0);`
    )
    expect(() =>
      db.exec(
        `INSERT INTO directory_shift_assignments VALUES ('b','overlap','entry','admin',0,0)`
      )
    ).toThrow(/SHIFT_OVERLAP/)
    expect(() =>
      db.exec(
        `INSERT INTO directory_shift_assignments VALUES ('c','cross-year','entry','admin',0,0)`
      )
    ).toThrow(/YEAR_MEMBERSHIP_REQUIRED/)
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_users").get()?.n).toBe(1)
  } finally {
    db.close()
  }
})
