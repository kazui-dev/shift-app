import type { DataEvent } from "@workspace/shared/live"
import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

import type { ApiEnv } from "../lib/http"
import { broadcastChange } from "../services/live-events"

/**
 * Announces what a write changed, once the handler has succeeded. Attach it to
 * each write route so the route itself declares the change it makes.
 */
export function announce(
  event: DataEvent | ((c: Context<ApiEnv>) => DataEvent | null)
) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    await next()
    if (!c.res.ok) return
    const change = typeof event === "function" ? event(c) : event
    if (change) c.executionCtx.waitUntil(broadcastChange(c.env, change))
  })
}
