import { Hono } from "hono"
import type { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vite-plus/test"

import { createAuth } from "../../src/auth"
import { d1Binding, migrated } from "../support/sqlite"

const origin = "https://shift.example.test"

const app = new Hono<{ Bindings: CloudflareBindings }>()
app.on(["GET", "POST"], "/api/auth/*", (c) =>
  createAuth(c.env).handler(c.req.raw)
)

function bindings(db: DatabaseSync, oauth: boolean) {
  return {
    shift_app: d1Binding(db),
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: "test-secret-value-for-sessions",
    DISCORD_CLIENT_ID: "client",
    DISCORD_CLIENT_SECRET: "secret",
    DISCORD_GUILD_ID: "guild",
    DISCORD_OAUTH_ENABLED: oauth ? "true" : "false",
  }
}

function signIn(db: DatabaseSync, body: Record<string, string>, oauth = false) {
  return app.request(
    "/api/auth/sign-in/roster",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    },
    bindings(db, oauth)
  )
}

/**
 * A year whose directory lists one student in a bureau with a duty, each
 * carrying a year role, beside a role the listing never names.
 */
function directory(db: DatabaseSync) {
  db.exec(`INSERT INTO operating_years (year, created_at, updated_at)
      VALUES (2026,0,0);
    INSERT INTO year_roles (id, year, name, color, created_at, updated_at)
      VALUES ('r-bureau',2026,'制作局','#111',0,0),
             ('r-duty',2026,'会場担当','#222',0,0),
             ('r-second',2026,'記録','#444',0,0),
             ('r-other',2026,'総務局','#333',0,0);
    INSERT INTO bureaus (id, year, name, role_id, created_at)
      VALUES ('b1',2026,'制作局','r-bureau',0);
    INSERT INTO duties (id, bureau_id, name, role_id, created_at)
      VALUES ('u1','b1','会場担当','r-duty',0),
             ('u2','b1','記録','r-second',0),
             ('u3','b1','名前だけの担当',NULL,0);
    INSERT INTO student_directory
        (id, year, student_id, display_name, bureau_id, office, created_at)
      VALUES ('d1',2026,'26AJ001','電大太郎','b1','局長',0);
    -- Held duties: two that name a role, and one the year has no role for.
    INSERT INTO directory_duties (entry_id, duty_id)
      VALUES ('d1','u1'),('d1','u2'),('d1','u3');`)
}

const taro = { studentId: "26aj001", displayName: "電大 太郎" }

describe("directory sign-in", () => {
  it("creates the member, places them in the year, and reuses the identity", async () => {
    const db = migrated()
    try {
      directory(db)
      const first = await signIn(db, taro)
      expect(first.status).toBe(200)
      await expect(first.json()).resolves.toEqual({ created: true })
      expect(first.headers.get("set-cookie")).toContain("session_token")

      // Members are never asked to sign in again, so a directory session runs
      // to the longest a cookie may live instead of expiring like a Discord one.
      const expires = db
        .prepare("SELECT expires_at AS at FROM session")
        .get()?.at
      expect(Number(expires)).toBeGreaterThan(
        Date.now() + 399 * 24 * 60 * 60 * 1000
      )

      // The directory spells the name; the typed spacing does not persist.
      expect(
        db.prepare("SELECT student_id, display_name FROM app_users").all()
      ).toEqual([{ student_id: "26AJ001", display_name: "電大太郎" }])
      expect(
        db
          .prepare(
            "SELECT year, status FROM year_memberships WHERE member_id = (SELECT id FROM app_users)"
          )
          .all()
      ).toEqual([{ year: 2026, status: "active" }])
      expect(
        db
          .prepare("SELECT role_id FROM member_year_roles ORDER BY role_id")
          .all()
      ).toEqual([
        { role_id: "r-bureau" },
        { role_id: "r-duty" },
        { role_id: "r-second" },
      ])

      const second = await signIn(db, { ...taro, studentId: "26AJ001" })
      await expect(second.json()).resolves.toEqual({ created: false })
      expect(db.prepare("SELECT count(*) AS n FROM user").get()?.n).toBe(1)
      expect(db.prepare("SELECT count(*) AS n FROM app_users").get()?.n).toBe(1)
      expect(
        db.prepare("SELECT provider_id, account_id FROM account").all()
      ).toEqual([{ provider_id: "roster", account_id: "26AJ001" }])
    } finally {
      db.close()
    }
  })

  it("joins the year without a role when the listing names none", async () => {
    const db = migrated()
    try {
      directory(db)
      db.exec(`INSERT INTO student_directory
          (id, year, student_id, display_name, bureau_id, office, created_at)
        VALUES ('d2',2026,'26AJ002','電大花子',NULL,NULL,0);`)

      const response = await signIn(db, {
        studentId: "26AJ002",
        displayName: "電大花子",
      })
      await expect(response.json()).resolves.toEqual({ created: true })
      expect(
        db.prepare("SELECT count(*) AS n FROM year_memberships").get()?.n
      ).toBe(1)
      expect(
        db.prepare("SELECT count(*) AS n FROM member_year_roles").get()?.n
      ).toBe(0)
    } finally {
      db.close()
    }
  })

  it("refuses a name the directory spells differently", async () => {
    const db = migrated()
    try {
      directory(db)
      const response = await signIn(db, {
        studentId: "26AJ001",
        displayName: "電大次郎",
      })
      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
        code: "DIRECTORY_MISMATCH",
      })
      expect(db.prepare("SELECT count(*) AS n FROM user").get()?.n).toBe(0)
    } finally {
      db.close()
    }
  })

  it("refuses a student ID the directory does not list", async () => {
    const db = migrated()
    try {
      directory(db)
      const response = await signIn(db, {
        studentId: "26AJ002",
        displayName: "電大花子",
      })
      expect(response.status).toBe(403)
      expect(db.prepare("SELECT count(*) AS n FROM app_users").get()?.n).toBe(0)
    } finally {
      db.close()
    }
  })

  it("joins the member an earlier Discord sign-in created", async () => {
    const db = migrated()
    try {
      directory(db)
      db.exec(`INSERT INTO user (id,name,email) VALUES ('u1','旧名','u1@example.test');
        INSERT INTO app_users
            (id, user_id, display_name, student_id, access_level, created_at, updated_at)
          VALUES ('m1','u1','旧名','26AJ001','leader',0,0);`)

      const response = await signIn(db, taro)
      await expect(response.json()).resolves.toEqual({ created: false })
      expect(db.prepare("SELECT count(*) AS n FROM user").get()?.n).toBe(1)
      expect(
        db
          .prepare("SELECT user_id, display_name, access_level FROM app_users")
          .all()
      ).toEqual([
        { user_id: "u1", display_name: "電大太郎", access_level: "leader" },
      ])
      expect(
        db.prepare("SELECT user_id, provider_id FROM account").all()
      ).toEqual([{ user_id: "u1", provider_id: "roster" }])
    } finally {
      db.close()
    }
  })

  it("refuses a malformed student ID", async () => {
    const db = migrated()
    try {
      directory(db)
      const response = await signIn(db, {
        studentId: "26AJ",
        displayName: "電大太郎",
      })
      expect(response.status).toBe(400)
    } finally {
      db.close()
    }
  })

  it("is not mounted while Discord OAuth is on", async () => {
    const db = migrated()
    try {
      directory(db)
      const response = await signIn(db, taro, true)
      expect(response.status).toBe(404)
    } finally {
      db.close()
    }
  })
})
