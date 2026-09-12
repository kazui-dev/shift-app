import { createMiddleware } from "hono/factory"
import type { ApiEnv } from "../lib/http"

// Roles, year membership and shift assignments also determine chat access.
// Broadcast no room data: clients recheck through authorized reads.
export const chatAccessEvents = createMiddleware<ApiEnv>(async (c, next) => {
  await next()
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method) &&
    /^\/api\/(years|year-settings|roles|activities|assignments|admin)(\/|$)/.test(
      c.req.path
    ) &&
    c.res.status >= 200 &&
    c.res.status < 300
  )
    c.executionCtx.waitUntil(
      c.env.CHAT_DIRECTORY.getByName("rooms").accessChanged()
    )
})
