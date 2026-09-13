import { Hono } from "hono"

import { apiError, errors } from "../../lib/errors"
import type { ApiEnv } from "../../lib/http"

export const eventsApp = new Hono<ApiEnv>()

eventsApp.get("/events", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
    return c.text("Expected WebSocket", 426)
  if (c.req.header("Origin") !== c.env.BETTER_AUTH_URL)
    return apiError(c, errors.forbiddenOrigin)
  const headers = new Headers({
    Upgrade: "websocket",
    "X-Chat-Member-Id": c.get("member").id,
  })
  return c.env.CHAT_DIRECTORY.getByName("rooms").fetch(
    new Request(c.req.url, { headers })
  )
})
