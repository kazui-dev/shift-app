import { count } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"

import { members } from "@workspace/db/schema"

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get("/api/health", async (c) => {
  const db = drizzle(c.env.shift_app)
  const [result] = await db.select({ value: count() }).from(members)

  return c.json({
    ok: true as const,
    database: "ready" as const,
    members: result.value,
    timestamp: new Date().toISOString(),
  })
})

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404)
})

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      message: "Unhandled request error",
      error: error.message,
      path: new URL(c.req.url).pathname,
    })
  )

  return c.json({ error: "Internal server error" }, 500)
})

export default app
