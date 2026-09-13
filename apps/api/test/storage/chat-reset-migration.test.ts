import { expect, it } from "vite-plus/test"
import { applyMigration, migrated, migrations } from "../support/sqlite"
it("resets only chat data, queues old storage cleanup, and removes all chat policy from the database", () => {
  const db = migrated(30)
  try {
    db.exec(`
   INSERT INTO operating_years VALUES(2026,0,0);
   INSERT INTO user(id,name,email) VALUES('u','Test','test@example.com');
   INSERT INTO app_users VALUES('m','u','Test','26AJ001','system_admin',0,0);
   INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES('a',2026,'Shift','Place','Shift',100,500,'#000000','m','m',0,0);
   INSERT INTO activity_responsibles VALUES('a','member','m');
   INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES('s','a',100,200);
   INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES('sa','s','m','active','m',0,0);
   INSERT INTO assignment_reports(id,assignment_id,member_id,kind,message,created_at,updated_at) VALUES('report','sa','m','late','Late',0,0);
   INSERT INTO attendance_records(id,assignment_id,member_id,checked_in_at,created_at,updated_at) VALUES('attendance','sa','m',110,0,0);
   INSERT INTO notification_devices(id,member_id,enabled,created_at,updated_at) VALUES('device','m',1,0,0);`)
    const rooms = db
      .prepare("SELECT id FROM chat_rooms")
      .all()
      .map((row) => String(row.id))
    for (const file of migrations().filter(
      (f) => Number(f.slice(0, 4)) >= 30
    )) {
      db.exec("BEGIN")
      applyMigration(db, file)
      db.exec("COMMIT")
    }
    expect(
      db
        .prepare("SELECT room_id FROM chat_room_deletions")
        .all()
        .map((row) => String(row.room_id))
        .sort()
    ).toEqual(rooms.sort())
    expect(db.prepare("SELECT * FROM chat_rooms").all()).toEqual([])
    for (const table of [
      "app_users",
      "activities",
      "shift_assignments",
      "assignment_reports",
      "attendance_records",
      "notification_devices",
    ])
      expect(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n).toBe(1)
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type IN ('view','trigger') AND sql LIKE '%chat_%'"
        )
        .all()
    ).toEqual([])
    expect(
      db
        .prepare("PRAGMA table_info(chat_rooms)")
        .all()
        .map((row) => row.name)
    ).not.toEqual(expect.arrayContaining(["kind", "activity_id"]))
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE name='chat_room_access'")
        .get()
    ).toBeUndefined()
  } finally {
    db.close()
  }
})
