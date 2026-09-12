import { URL } from "node:url"
import { DatabaseSync } from "node:sqlite"
import { readFileSync } from "node:fs"
import { expect, it } from "vite-plus/test"
it("preserves push settings and delivery history with foreign keys enabled inside a migration transaction", () => {
  const db = new DatabaseSync(":memory:")
  try {
    db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE app_users(id TEXT PRIMARY KEY);
      CREATE TABLE shift_assignments(id TEXT PRIMARY KEY);
      CREATE TABLE push_subscriptions(id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, expiration_time INTEGER, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE notification_deliveries(assignment_id TEXT REFERENCES shift_assignments(id) ON DELETE CASCADE, subscription_id TEXT REFERENCES push_subscriptions(id) ON DELETE CASCADE, kind TEXT, status TEXT NOT NULL DEFAULT 'claimed', claimed_at INTEGER NOT NULL, sent_at INTEGER, PRIMARY KEY(assignment_id,subscription_id,kind));
      INSERT INTO app_users VALUES ('user');
      INSERT INTO shift_assignments VALUES ('shift');
      INSERT INTO push_subscriptions VALUES ('device','user','https://push.example',NULL,'key','auth',0,0);
      INSERT INTO notification_deliveries VALUES ('shift','device','ten_minute','sent',1,2);
      BEGIN;`)
    db.exec(
      readFileSync(
        new URL("../migrations/0026_push_devices.sql", import.meta.url),
        "utf8"
      )
    )
    db.exec("COMMIT")
    expect(
      db.prepare("SELECT id, enabled, endpoint FROM push_devices").get()
    ).toMatchObject({
      id: "device",
      enabled: 1,
      endpoint: "https://push.example",
    })
    expect(
      db
        .prepare("SELECT subscription_id,status FROM notification_deliveries")
        .get()
    ).toMatchObject({ subscription_id: "device", status: "sent" })
    db.exec("UPDATE push_devices SET endpoint=NULL,p256dh=NULL,auth=NULL")
    expect(db.prepare("SELECT enabled FROM push_devices").get()?.enabled).toBe(
      1
    )
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([])
  } finally {
    db.close()
  }
})
