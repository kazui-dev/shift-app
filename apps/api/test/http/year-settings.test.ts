import { Hono } from "hono"
import { describe, expect, it } from "vite-plus/test"

import type { ApiEnv, MemberContext } from "../../src/lib/http"
import { yearSettingsApp } from "../../src/features/years/routes/year-settings"

function appFor(accessLevel: MemberContext["accessLevel"]) {
  const app = new Hono<ApiEnv>()
  app.use("*", async (c, next) => {
    c.set("member", {
      id: "actor",
      userId: "user",
      displayName: "Test",
      accessLevel,
    })
    await next()
  })
  app.route("/year-settings", yearSettingsApp)
  return app
}

describe("default year mutation boundary", () => {
  it.each(["member", "leader"] as const)(
    "rejects %s before accessing storage",
    async (level) => {
      const response = await appFor(level).request("/year-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultYear: 2026 }),
      })
      expect(response.status).toBe(403)
    }
  )

  it.each([
    "{",
    "{}",
    '{"defaultYear":null}',
    '{"defaultYear":2026,"status":"active"}',
  ])(
    "rejects invalid admin input %s before accessing storage",
    async (body) => {
      const response = await appFor("system_admin").request("/year-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      })
      expect(response.status).toBe(422)
    }
  )
})
