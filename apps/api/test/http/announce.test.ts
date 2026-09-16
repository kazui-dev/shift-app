import { Hono } from "hono"
import { expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { announce } from "../../src/routes/announce"

it("announces a route's change only after the write succeeds", async () => {
  const broadcast = vi
    .fn<(event: unknown) => Promise<void>>()
    .mockResolvedValue()
  const env = { CHAT_DIRECTORY: { getByName: () => ({ broadcast }) } }
  let committed = false
  const context = {
    waitUntil: (task: Promise<unknown>) => {
      expect(committed).toBe(true)
      return task
    },
    passThroughOnException() {},
    props: {},
  }
  const app = new Hono<ApiEnv>()
  app.put("/shifts", announce({ type: "shifts_changed" }), (c) => {
    committed = true
    return c.body(null, c.req.query("denied") ? 403 : 204)
  })
  app.put(
    "/years/:year",
    announce((c) => {
      const year = Number(c.req.param("year"))
      return Number.isInteger(year)
        ? { type: "availability_changed", year }
        : null
    }),
    (c) => {
      committed = true
      return c.body(null, 204)
    }
  )
  await app.request("/shifts", { method: "PUT" }, env, context)
  await app.request("/shifts?denied=1", { method: "PUT" }, env, context)
  await app.request("/years/2026", { method: "PUT" }, env, context)
  await app.request("/years/next", { method: "PUT" }, env, context)
  expect(broadcast.mock.calls).toEqual([
    [{ type: "shifts_changed" }],
    [{ type: "availability_changed", year: 2026 }],
  ])
})
