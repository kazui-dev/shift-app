import { Hono } from "hono"

import { createAuth } from "./auth"
import { apiErrorBody } from "./lib/http"
import { accountApp } from "./routes/account"
import { adminApp } from "./routes/admin/index"
import { apiApp } from "./routes/api"

export const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use("/api/auth/*", async (c, next) => {
  const url = new URL(c.req.url)
  const isOAuthCallback = url.pathname.startsWith("/api/auth/callback/")

  if (isOAuthCallback) {
    console.info(
      JSON.stringify({
        message: "OAuth callback received",
        provider: url.pathname.split("/").at(-1),
        hasCode: url.searchParams.has("code"),
        hasState: url.searchParams.has("state"),
        hasCookie: c.req.header("Cookie") !== undefined,
      })
    )
  }

  await next()

  if (isOAuthCallback) {
    const location = c.res.headers.get("Location")
    console.info(
      JSON.stringify({
        message: "OAuth callback completed",
        status: c.res.status,
        redirectPath: location ? new URL(location, url.origin).pathname : null,
      })
    )
  }
})

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return createAuth(c.env).handler(c.req.raw)
})

app.get("/api/health", async (c) => {
  const result = await c.env.shift_app
    .prepare("SELECT 1 AS ok")
    .first<{ ok: number }>()

  if (result?.ok !== 1) {
    return c.json({ ok: false as const, database: "unavailable" as const }, 503)
  }

  return c.json({
    ok: true as const,
    database: "ready" as const,
    timestamp: new Date().toISOString(),
  })
})

app.route("/api", accountApp)
app.route("/api/admin", adminApp)
app.route("/api", apiApp)

app.notFound((c) => c.json(apiErrorBody("NOT_FOUND", "Route not found"), 404))

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      message: "Unhandled request error",
      error: error.message,
      path: new URL(c.req.url).pathname,
    })
  )

  return c.json(apiErrorBody("INTERNAL_ERROR", "Internal server error"), 500)
})
