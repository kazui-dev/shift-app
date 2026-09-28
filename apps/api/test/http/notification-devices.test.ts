import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import { URL } from "node:url"
import { readFileSync, readdirSync } from "node:fs"
import { Hono } from "hono"
import { expect, it } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { notificationDevicesApp } from "../../src/features/notifications/routes/push"
const app = new Hono<ApiEnv>().route(
  "/me/notification-devices",
  notificationDevicesApp
)
it.each([
  "bad-id",
  "00000000-0000-4000-8000-000000000000",
  "00000000-0000-4000-8000-000000000000/subscription",
])("validates device input before database access: %s", async (path) => {
  const response = await app.request(`/me/notification-devices/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: "bad" }),
  })
  expect(response.status).toBe(422)
})

it("stores preferences independently and a late subscription cannot turn an OFF device back ON", async () => {
  const db = new DatabaseSync(":memory:")
  try {
    const folder = new URL("../../migrations/", import.meta.url)
    for (const file of readdirSync(folder)
      .filter((name) => name.endsWith(".sql"))
      .sort())
      db.exec(readFileSync(new URL(file, folder), "utf8"))
    db.exec(`INSERT INTO user(id,name,email) VALUES ('ua','Alice','a@example.com'),('ub','Bob','b@example.com');
      INSERT INTO app_users VALUES ('alice','ua','Alice','26AJ001','member',0,0),('bob','ub','Bob','26AJ002','member',0,0);`)
    const env = {
      shift_app: {
        prepare: (sql: string) => ({
          bind: (...values: SQLInputValue[]) => ({
            run: async () => ({
              meta: { changes: Number(db.prepare(sql).run(...values).changes) },
            }),
            all: async () => ({ results: db.prepare(sql).all(...values) }),
          }),
        }),
      },
    }
    const server = (memberId: string) => {
      const instance = new Hono<ApiEnv>()
      instance.use("*", async (c, next) => {
        c.set("member", {
          id: memberId,
          userId: "user",
          displayName: "Test",
          accessLevel: "member",
        })
        await next()
      })
      return instance.route("/devices", notificationDevicesApp)
    }
    const alice = server("alice"),
      bob = server("bob")
    const id = "00000000-0000-4000-8000-000000000000"
    const put = (body: unknown) => ({
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    expect(await (await alice.request("/devices", {}, env)).json()).toEqual([])
    expect(
      (await alice.request(`/devices/${id}`, put({ enabled: true }), env))
        .status
    ).toBe(204)
    expect(await (await alice.request("/devices", {}, env)).json()).toEqual([
      { id, enabled: true, endpoint: null },
    ])
    expect(
      (await alice.request(`/devices/${id}`, put({ enabled: false }), env))
        .status
    ).toBe(204)
    const subscription = {
      endpoint: "https://push.example/1",
      expirationTime: null,
      keys: { p256dh: "key", auth: "auth" },
    }
    expect(
      (
        await alice.request(
          `/devices/${id}/subscription`,
          put(subscription),
          env
        )
      ).status
    ).toBe(204)
    expect(await (await alice.request("/devices", {}, env)).json()).toEqual([
      { id, enabled: false, endpoint: subscription.endpoint },
    ])
    expect(
      (await bob.request(`/devices/${id}`, put({ enabled: true }), env)).status
    ).toBe(404)
    expect(
      (await bob.request(`/devices/${id}/subscription`, put(subscription), env))
        .status
    ).toBe(409)
    expect(await (await bob.request("/devices", {}, env)).json()).toEqual([])
  } finally {
    db.close()
  }
})
