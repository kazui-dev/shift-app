import type { Handler } from "hono"

import { apiError, errors } from "../../../lib/errors"
import type { ApiEnv } from "../../../lib/http"
import { liveDirectory } from "../services/live-events"

/** Opens the member's live connection for chat and every other change. */
export const openLiveEvents: Handler<ApiEnv> = async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
    return c.text("Expected WebSocket", 426)
  if (c.req.header("Origin") !== c.env.BETTER_AUTH_URL)
    return apiError(c, errors.forbiddenOrigin)
  const headers = new Headers({
    Upgrade: "websocket",
    "X-Member-Id": c.get("member").id,
  })
  return liveDirectory(c.env).fetch(new Request(c.req.url, { headers }))
}
