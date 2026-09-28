import { describe, expect, it } from "vite-plus/test"
import { applyMigration, migrated } from "../support/sqlite"
import { participantWork } from "../support/participant-work"

describe("participants without an authentication account", () => {
  it("preserves dependent data, constraints and triggers while allowing an unclaimed participant", () => {
    const db = migrated(39)
    try {
      db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
        INSERT INTO user (id,name,email) VALUES ('u','Member','member@example.test');
        INSERT INTO app_users VALUES ('m','u','Member','26AJ001','member',0,0);`)
      participantWork(db, "m")
      db.exec(`
        INSERT INTO availability_drafts VALUES (2026,'m','[]',0);
        INSERT INTO year_roles (id,year,name,color,created_at,updated_at) VALUES ('role',2026,'役割','#000000',0,0);
        INSERT INTO member_year_roles VALUES ('m','role',0);
        INSERT INTO activity_candidate_roles VALUES ('work','role');
        INSERT INTO activity_responsibles VALUES ('work','member','m');
        INSERT INTO activity_notifications VALUES ('work','m',1,'pending',0);
        INSERT INTO activity_history VALUES ('history','work','m','{}','{}',0);
        INSERT INTO chat_rooms (id,year,name,created_by,created_at,updated_at) VALUES ('room',2026,'Room','m',0,0);
        INSERT INTO activity_chat_rooms VALUES ('work','room');
        INSERT INTO chat_room_targets (room_id,target_type,target_id,created_at) VALUES ('room','member','m',0);
        INSERT INTO chat_room_preferences VALUES ('room','m',0,1);
        INSERT INTO chat_room_exits VALUES ('room','m',0);
        INSERT INTO chat_message_index (room_id,sequence,member_id) VALUES ('room',1,'m');
        INSERT INTO chat_room_bots SELECT 'room',id,0 FROM bots;
        INSERT INTO assignment_attendance (assignment_id,member_id,state,created_at,updated_at) VALUES ('assignment','m','absent',0,0);
        INSERT INTO assignment_attendance_events (id,assignment_id,actor_id,action,created_at) VALUES ('event','assignment','m','absent',0);
        INSERT INTO notification_devices (id,member_id,enabled,created_at,updated_at) VALUES ('device','m',0,0,0);
        INSERT INTO notification_deliveries (assignment_id,subscription_id,kind,claimed_at) VALUES ('assignment','device','ten_minute',0);
        INSERT INTO admin_audit_logs (id,actor_user_id,actor_type,action,target_member_id,created_at) VALUES ('audit','u','system_admin','test','m',0);
      `)
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        .all()
      const snapshot = () =>
        tables.map(({ name }) => {
          if (typeof name !== "string") throw new Error("Invalid table name")
          return [
            name,
            db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),
          ]
        })
      const before = snapshot()
      const schemaObjects = () =>
        db
          .prepare(
            "SELECT type,name,sql FROM sqlite_master WHERE type IN ('trigger','view','index') AND sql IS NOT NULL ORDER BY name"
          )
          .all()
      const objects = schemaObjects()
      applyMigration(db, "0039_pending_members.sql")
      expect(snapshot()).toEqual(before)
      expect(schemaObjects()).toEqual(objects)
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
      db.exec(`INSERT INTO app_users (id,display_name,student_id,created_at,updated_at)
        VALUES ('pending','Pending','26AJ002',0,0);`)
      expect(
        db.prepare("SELECT user_id FROM app_users WHERE id='pending'").get()
          ?.user_id
      ).toBeNull()
      expect(
        db
          .prepare(
            "SELECT status FROM year_memberships WHERE member_id='pending'"
          )
          .get()?.status
      ).toBe("active")
      expect(() =>
        db.exec("UPDATE app_users SET user_id='u' WHERE id='pending'")
      ).toThrow()
      expect(() =>
        db.exec("UPDATE app_users SET student_id='26aj001' WHERE id='pending'")
      ).toThrow()
      expect(() =>
        db.exec("UPDATE app_users SET user_id='missing' WHERE id='pending'")
      ).toThrow()
      expect(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE name LIKE '__pending_%'"
          )
          .all()
      ).toEqual([])
      db.exec("DELETE FROM app_users WHERE id='pending'")
      applyMigration(db, "0040_directory_work.sql")
      applyMigration(db, "0041_registered_members_only.sql")
      expect(snapshot()).toEqual(before)
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
      expect(() =>
        db.exec(`INSERT INTO app_users (id,display_name,student_id,created_at,updated_at)
        VALUES ('pending','Pending','26AJ002',0,0)`)
      ).toThrow(/NOT NULL/)
    } finally {
      db.close()
    }
  })
})
