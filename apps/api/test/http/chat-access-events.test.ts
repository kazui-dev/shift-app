import { Hono } from "hono"
import { expect, it, vi } from "vite-plus/test"
import type { ApiEnv } from "../../src/lib/http"
import { chatAccessEvents } from "../../src/lib/chat-access-events"
it("publishes access invalidation only after successful related mutations, not reads, denied requests or chat writes", async () => {
  const publish = vi.fn<() => Promise<void>>().mockResolvedValue()
  const env = {
    CHAT_DIRECTORY: { getByName: () => ({ accessChanged: publish }) },
  }
  const app = new Hono<ApiEnv>()
  let committed = false
  app.use("/api/*", chatAccessEvents)
  app.all("*", (c) => {
    committed = true
    return c.body(null, c.req.query("denied") ? 403 : 204)
  })
  const context = {
    waitUntil: (task: Promise<unknown>) => {
      expect(committed).toBe(true)
      return task
    },
    passThroughOnException() {},
    props: {},
  }
  await Promise.all(
    [
      "years/2026/members",
      "activities/shift",
      "roles/role",
      "assignments/assignment",
      "admin/users/user",
    ].map(
      async (path) =>
        await app.request(`/api/${path}`, { method: "PATCH" }, env, context)
    )
  )
  expect(publish).toHaveBeenCalledTimes(5)
  await Promise.all(
    [
      ["years", "GET"],
      ["roles/role?denied=1", "PATCH"],
      ["chat/rooms", "POST"],
      ["me/availability/2026", "PUT"],
    ].map(
      async ([path, method]) =>
        await app.request(
          `/api/${path}`,
          { method: method ?? "GET" },
          env,
          context
        )
    )
  )
  expect(publish).toHaveBeenCalledTimes(5)
})
