import { readFileSync, readdirSync } from "node:fs"
import { URL } from "node:url"
import { DatabaseSync } from "node:sqlite"
import { expect, it } from "vite-plus/test"

it("removes archive state while retaining chats, permissions and automatic room creation", () => {
  const db = new DatabaseSync(":memory:")
  const folder = new URL("../migrations/", import.meta.url)
  try {
    db.exec("PRAGMA foreign_keys=ON")
    for (const name of readdirSync(folder)
      .filter((file) => file.endsWith(".sql") && Number(file.slice(0, 4)) < 28)
      .sort())
      db.exec(readFileSync(new URL(name, folder), "utf8"))
    db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
      INSERT INTO user (id,name,email) VALUES ('u','Test','test@example.com');
      INSERT INTO app_users VALUES ('m','u','Test','26AJ001','member',0,0);
      INSERT INTO chat_rooms(id,year,name,status,created_by,created_at,updated_at,last_sequence) VALUES('custom',2026,'Test','archived','m',0,0,12);
      INSERT INTO chat_room_preferences(room_id,member_id,muted,last_read) VALUES('custom','m',1,7);
      BEGIN;`)
    db.exec(
      readFileSync(new URL("0028_remove_chat_archive.sql", folder), "utf8")
    )
    db.exec("COMMIT")
    expect(
      db
        .prepare("SELECT name,last_sequence FROM chat_rooms WHERE id='custom'")
        .get()
    ).toMatchObject({ name: "Test", last_sequence: 12 })
    expect(
      db
        .prepare(
          "SELECT muted,last_read FROM chat_room_preferences WHERE room_id='custom'"
        )
        .get()
    ).toMatchObject({ muted: 1, last_read: 7 })
    expect(
      db
        .prepare(
          "SELECT can_post,can_manage FROM chat_effective_permissions WHERE room_id='custom' AND member_id='m'"
        )
        .get()
    ).toMatchObject({ can_post: 1, can_manage: 1 })
    expect(() =>
      db.exec("INSERT INTO chat_room_exits VALUES('custom','m',1000)")
    ).toThrow("LAST_CHAT_MANAGER")
    expect(
      db
        .prepare("PRAGMA table_info(chat_rooms)")
        .all()
        .some((column) => column.name === "status")
    ).toBe(false)
    db.exec(`INSERT INTO operating_years VALUES(2027,0,0);
      INSERT INTO activities(id,year,name,place,activity_type,color,starts_at,ends_at,created_by,updated_by,created_at,updated_at) VALUES('shift',2026,'Shift','Place','Shift','#000000',100,500,'m','m',0,0);`)
    expect(
      db.prepare("SELECT kind FROM chat_rooms WHERE id='shift'").get()?.kind
    ).toBe("shift")
    expect(
      db
        .prepare(
          "SELECT count(*) AS count FROM chat_rooms WHERE year=2027 AND kind='global'"
        )
        .get()?.count
    ).toBe(1)
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})
