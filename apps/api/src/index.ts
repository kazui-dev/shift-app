import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { identityLinkRequests, members } from "@workspace/db/schema"
import { onboardingInputSchema } from "@workspace/shared/auth"

import { createAuth, getConfiguredProviders } from "./auth"
import { adminApp } from "./admin"

const app = new Hono<{ Bindings: CloudflareBindings }>()

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

app.get("/api/auth-state", async (c) => {
  const auth = createAuth(c.env)
  const authSession = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  const providers = getConfiguredProviders(c.env)

  if (!authSession) {
    return c.json({ status: "anonymous" as const, providers })
  }

  const accounts = await auth.api.listUserAccounts({
    headers: c.req.raw.headers,
  })
  const linkedProviders = accounts
    .map((account) => account.providerId)
    .filter((provider): provider is "discord" => provider === "discord")

  const db = drizzle(c.env.shift_app)
  const [member] = await db
    .select({
      displayName: members.displayName,
      studentId: members.studentId,
      accessLevel: members.accessLevel,
    })
    .from(members)
    .where(eq(members.userId, authSession.user.id))
    .limit(1)

  if (!member) {
    return c.json({
      status: "onboarding" as const,
      providers,
      linkedProviders,
    })
  }

  return c.json({
    status: "active" as const,
    member,
    providers,
    linkedProviders,
  })
})

app.post(
  "/api/onboarding",
  bodyLimit({
    maxSize: 4 * 1024,
    onError: (c) => c.json({ error: "Request body is too large" }, 413),
  }),
  async (c) => {
    const origin = c.req.header("Origin")
    if (origin && origin !== c.env.BETTER_AUTH_URL) {
      return c.json({ error: "Forbidden origin" }, 403)
    }

    const auth = createAuth(c.env)
    const authSession = await auth.api.getSession({
      headers: c.req.raw.headers,
    })
    if (!authSession) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON" }, 400)
    }

    const parsed = onboardingInputSchema.safeParse(payload)
    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid onboarding data",
          issues: parsed.error.flatten().fieldErrors,
        },
        400
      )
    }

    const db = drizzle(c.env.shift_app)
    const [currentMember] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.userId, authSession.user.id))
      .limit(1)

    if (currentMember) {
      return c.json({ ok: true as const })
    }

    const { studentId, displayName } = parsed.data
    const [targetMember] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.studentId, studentId))
      .limit(1)

    if (targetMember) {
      const [existingRequest] = await db
        .select({ id: identityLinkRequests.id })
        .from(identityLinkRequests)
        .where(
          and(
            eq(identityLinkRequests.requesterUserId, authSession.user.id),
            eq(identityLinkRequests.status, "pending")
          )
        )
        .limit(1)

      if (!existingRequest) {
        await db.insert(identityLinkRequests).values({
          id: crypto.randomUUID(),
          requesterUserId: authSession.user.id,
          targetMemberId: targetMember.id,
          status: "pending",
          createdAt: new Date(),
        })
      }

      return c.json(
        {
          error: "Account already exists",
          code: "ACCOUNT_EXISTS" as const,
          linkRequestCreated: true as const,
        },
        409
      )
    }

    const now = new Date()
    try {
      await db.insert(members).values({
        id: crypto.randomUUID(),
        userId: authSession.user.id,
        displayName,
        studentId,
        accessLevel: "member",
        createdAt: now,
        updatedAt: now,
      })
    } catch (error) {
      console.warn(
        JSON.stringify({
          message: "Onboarding insert conflict",
          userId: authSession.user.id,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      )
      return c.json(
        {
          error: "Account could not be created",
          code: "ACCOUNT_CONFLICT" as const,
        },
        409
      )
    }

    return c.json({ ok: true as const }, 201)
  }
)

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

app.route("/api/admin", adminApp)

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
