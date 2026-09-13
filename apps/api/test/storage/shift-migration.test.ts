import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vite-plus/test"
import { applyMigration, migrations } from "../support/sqlite"

function migrate(db: DatabaseSync, first: number, last: number) {
  for (const file of migrations(last + 1).filter(
    (name) => Number(name.slice(0, 4)) >= first
  ))
    applyMigration(db, file)
}
describe("shift slot migration", () => {
  it("retains assignments, attendance, reports and notification records", () => {
    const db = new DatabaseSync(":memory:")
    try {
      db.exec("PRAGMA foreign_keys=ON")
      migrate(db, 0, 14)
      db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
        INSERT INTO user (id,name,email) VALUES ('u','Test','test@example.com');
        INSERT INTO members VALUES ('m','u','Test','26AJ001','member',0,0);
        INSERT INTO activities (id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES ('a',2026,'Shift','Place','Shift',100,500,'#000000','m','m',0,0);
        INSERT INTO shift_assignments (id,activity_id,member_id,starts_at,ends_at,status,created_by,created_at,updated_at) VALUES ('assignment','a','m',100,200,'active','m',0,0);
        INSERT INTO attendance_records VALUES ('attendance','assignment','m',110,0,0);
        INSERT INTO assignment_reports (id,assignment_id,member_id,kind,message,created_at,updated_at) VALUES ('report','assignment','m','late','late',0,0);
        INSERT INTO push_subscriptions (id,member_id,endpoint,p256dh,auth,created_at,updated_at) VALUES ('subscription','m','https://example.com','key','auth',0,0);
        INSERT INTO notification_deliveries (assignment_id,subscription_id,kind,claimed_at) VALUES ('assignment','subscription','created',0);`)
      migrate(db, 15, 16)
      for (const table of [
        "shift_assignments",
        "attendance_records",
        "assignment_reports",
        "notification_deliveries",
      ])
        expect(
          db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count
        ).toBe(1)
      expect(
        db
          .prepare(
            "SELECT starts_at, ends_at FROM shift_slots WHERE id=(SELECT slot_id FROM shift_assignments WHERE id='assignment')"
          )
          .get()
      ).toMatchObject({ starts_at: 100, ends_at: 200 })
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
      db.exec(
        "INSERT INTO shift_slots (id,activity_id,starts_at,ends_at) VALUES ('overlap','a',150,250)"
      )
      expect(() =>
        db.exec(
          "INSERT INTO shift_assignments (id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES ('second','overlap','m','active','m',0,0)"
        )
      ).toThrow("SHIFT_OVERLAP")
      expect(
        db
          .prepare("SELECT year FROM year_memberships WHERE member_id='m'")
          .get()?.year
      ).toBe(2026)

      migrate(db, 17, 19)
      expect(
        db
          .prepare(
            "SELECT status FROM attendance_records WHERE id='attendance'"
          )
          .get()?.status
      ).toBe("confirmed")
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM chat_rooms WHERE kind='global'"
          )
          .get()?.count
      ).toBe(1)
      expect(
        db
          .prepare(
            "SELECT can_post FROM chat_effective_permissions WHERE room_id='a' AND member_id='m'"
          )
          .get()?.can_post
      ).toBe(1)
      db.exec("DELETE FROM activity_responsibles WHERE activity_id='a'")
      expect(
        db
          .prepare(
            "SELECT can_read FROM chat_effective_permissions WHERE room_id='a' AND member_id='m'"
          )
          .get()?.can_read
      ).toBe(1)
      db.exec(
        "UPDATE shift_assignments SET status='cancelled' WHERE id='assignment'"
      )
      expect(
        db
          .prepare(
            "SELECT exited_at FROM chat_room_access WHERE room_id='a' AND member_id='m'"
          )
          .get()?.exited_at
      ).toEqual(expect.any(Number))
      db.exec(
        "UPDATE shift_assignments SET status='active' WHERE id='assignment'"
      )
      expect(
        db
          .prepare(
            "SELECT exited_at FROM chat_room_access WHERE room_id='a' AND member_id='m'"
          )
          .get()?.exited_at
      ).toBeNull()
      migrate(db, 20, 20)
      expect(() =>
        db.exec("UPDATE activities SET active=1 WHERE id='a'")
      ).toThrow("RESPONSIBLE_REQUIRED")
      db.exec(
        "INSERT INTO activity_responsibles VALUES ('a','member','m'); UPDATE activities SET active=1 WHERE id='a'"
      )
      db.exec("DELETE FROM activity_responsibles WHERE activity_id='a'")
      expect(
        db.prepare("SELECT active FROM activities WHERE id='a'").get()?.active
      ).toBe(0)
      db.exec("UPDATE activities SET active=0 WHERE id='a'")
      expect(
        db
          .prepare(
            "SELECT can_post FROM chat_effective_permissions WHERE room_id='a' AND member_id='m'"
          )
          .get()?.can_post
      ).toBe(0)
      migrate(db, 21, 25)
      expect(
        db.prepare("SELECT id FROM app_users WHERE id='m'").get()?.id
      ).toBe("m")
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM attendance_records").get()
          ?.count
      ).toBe(1)
      db.exec(
        "INSERT INTO chat_rooms(id,year,name,created_by,created_at,updated_at,kind) VALUES('custom',2026,'Room','m',0,0,'custom')"
      )
      expect(() =>
        db.exec("INSERT INTO chat_room_exits VALUES('custom','m',1000)")
      ).toThrow("LAST_CHAT_MANAGER")
      db.exec(
        "UPDATE chat_rooms SET status='archived' WHERE id='custom'; INSERT INTO chat_room_exits VALUES('custom','m',1000)"
      )
      expect(
        db
          .prepare(
            "SELECT can_read FROM chat_effective_permissions WHERE room_id='custom' AND member_id='m'"
          )
          .get()
      ).toBeUndefined()
      expect(
        db
          .prepare(
            "SELECT exited_at FROM chat_room_access WHERE room_id='custom' AND member_id='m'"
          )
          .get()?.exited_at
      ).toBe(1000)
      db.exec(
        "INSERT INTO chat_room_targets(room_id,target_type,target_id,can_read,can_post,can_manage,created_at) VALUES('custom','member','m',1,1,1,1100)"
      )
      expect(
        db
          .prepare(
            "SELECT exited_at FROM chat_room_access WHERE room_id='custom' AND member_id='m'"
          )
          .get()?.exited_at
      ).toBeNull()
      db.exec(
        "DELETE FROM shift_assignments; DELETE FROM activities WHERE id='a'"
      )
      expect(
        db
          .prepare("SELECT room_id FROM chat_room_deletions WHERE room_id='a'")
          .get()
      ).toMatchObject({ room_id: "a" })
      expect(
        db.prepare("SELECT id FROM chat_rooms WHERE id='a'").get()
      ).toBeUndefined()
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
    } finally {
      db.close()
    }
  })
})
