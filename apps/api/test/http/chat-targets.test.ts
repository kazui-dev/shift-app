import { activityRoom, roomCommands } from "../../src/services/chat-creation"
import { chatApp } from "../../src/routes/chat/index"
import { URL } from "node:url"
import { readFileSync, readdirSync } from "node:fs"
import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { meAssignmentsApp } from "../../src/routes/me/assignments"

describe("migrated chat and calendar queries", () => {
  it("loads active shift targets and the calendar against the current schema", async () => {
    const db = new DatabaseSync(":memory:")
    try {
      const folder = new URL("../../migrations/", import.meta.url)
      for (const file of readdirSync(folder)
        .filter((name) => name.endsWith(".sql"))
        .sort())
        db.exec(readFileSync(new URL(file, folder), "utf8"))
      db.exec(`INSERT INTO operating_years VALUES (2026,0,0);
        INSERT INTO user (id,name,email) VALUES ('u','Test','test@example.com');
        INSERT INTO app_users VALUES ('m','u','Test','26AJ001','member',0,0);
        INSERT OR IGNORE INTO year_memberships(year,member_id,status,created_at,updated_at) VALUES (2026,'m','active',0,0);
        INSERT INTO activities(id,year,name,place,activity_type,starts_at,ends_at,color,created_by,updated_by,created_at,updated_at) VALUES ('a',2026,'受付','入口','シフト',100,500,'#888888','m','m',0,0);
        INSERT INTO activity_responsibles(activity_id,target_type,target_id) VALUES ('a','member','m');
        UPDATE activities SET active=1 WHERE id='a';`)
      for (const { sql, params } of roomCommands(
        activityRoom({ id: "a", year: 2026, name: "受付", createdBy: "m" }),
        0
      ))
        db.prepare(sql).run(...params)
      const app = new Hono<ApiEnv>()
      app.use("*", async (c, next) => {
        c.set("member", {
          id: "m",
          userId: "u",
          displayName: "Test",
          accessLevel: "member",
        })
        await next()
      })
      app.route("/chat", chatApp)
      app.route("/chat", chatApp)
      app.route("/me", meAssignmentsApp)
      const env = {
        shift_app: {
          batch: (
            statements: { all: () => Promise<{ results: unknown[] }> }[]
          ) => Promise.all(statements.map((statement) => statement.all())),
          prepare: (sql: string) => ({
            bind: (...values: SQLInputValue[]) => ({
              first: () =>
                Promise.resolve(db.prepare(sql).get(...values) ?? null),
              all: () =>
                Promise.resolve({ results: db.prepare(sql).all(...values) }),
            }),
          }),
        },
      }
      const targets = await app.request("/chat/targets?year=2026", {}, env)
      expect(targets.status).toBe(200)
      expect(await targets.json()).toMatchObject({
        targets: expect.arrayContaining([
          {
            targetType: "member",
            image: null,
            roleIds: [],
            activityIds: [],
            targetId: "m",
            displayName: "Test",
          },
          { targetType: "activity", targetId: "a", displayName: "受付" },
        ]),
      })
      const rooms = await app.request("/chat/rooms?year=2026", {}, env)
      expect(rooms.status).toBe(200)
      expect(await rooms.json()).toMatchObject({
        rooms: expect.arrayContaining([
          expect.objectContaining({
            activityId: "a",
            activityStartsAt: new Date(100).toISOString(),
            activityEndsAt: new Date(500).toISOString(),
          }),
        ]),
      })
      db.exec("UPDATE activities SET active=0 WHERE id='a'")
      const inactive = await app.request("/chat/targets?year=2026", {}, env)
      expect(await inactive.json()).toMatchObject({
        targets: expect.arrayContaining([
          {
            targetType: "member",
            image: null,
            roleIds: [],
            activityIds: [],
            targetId: "m",
            displayName: "Test",
          },
        ]),
      })
      const calendar = await app.request(
        "/me/assignments?year=2026&from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z",
        {},
        env
      )
      expect(calendar.status).toBe(200)
      expect(await calendar.json()).toEqual({ assignments: [] })
      const roleId = "a8551d2e-4d76-4fd7-b89b-f9a4ae2e33f1"
      db.exec(`INSERT INTO year_roles(id,year,name,color,created_at,updated_at) VALUES ('${roleId}',2026,'担当','#888888',0,0);
        INSERT INTO member_year_roles VALUES ('m','${roleId}',0);
        INSERT INTO shift_slots(id,activity_id,starts_at,ends_at) VALUES ('s','a',100,200);
        INSERT INTO shift_assignments(id,slot_id,member_id,status,created_by,created_at,updated_at) VALUES ('sa','s','m','active','m',0,0);
        UPDATE activities SET active=1 WHERE id='a';`)
      const memberships = await app.request("/chat/targets?year=2026", {}, env)
      expect(await memberships.json()).toMatchObject({
        targets: expect.arrayContaining([
          expect.objectContaining({
            targetId: "m",
            roleIds: [roleId],
            activityIds: ["a"],
          }),
          expect.objectContaining({ targetType: "role", targetId: roleId }),
        ]),
      })
      const published = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined)
      const tasks: Promise<unknown>[] = []
      const created = await app.request(
        "/chat/rooms",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year: 2026,
            name: "担当連絡",
            targets: [{ targetType: "role", targetId: roleId }],
          }),
        },
        {
          ...env,
          CHAT_DIRECTORY: { getByName: () => ({ publish: published }) },
        },
        {
          waitUntil: (task) => {
            tasks.push(task)
          },
          passThroughOnException: () => {},
          props: {},
        }
      )
      await Promise.all(tasks)
      expect(published).toHaveBeenCalledWith(["m"], {
        type: "room_changed",
        roomId: expect.any(String),
      })
      expect(created.status).toBe(201)
      db.exec("UPDATE shift_assignments SET status='cancelled' WHERE id='sa'")
      const cancelled = await app.request("/chat/targets?year=2026", {}, env)
      expect(await cancelled.json()).toMatchObject({
        targets: expect.arrayContaining([
          expect.objectContaining({ targetId: "m", activityIds: [] }),
        ]),
      })
    } finally {
      db.close()
    }
  })
})
