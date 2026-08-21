import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import * as v from "valibot"

import { identityLinkRequests, members } from "@workspace/db/schema"
import { onboardingInputSchema } from "@workspace/shared/auth"

import { createAuth, getConfiguredProviders } from "../auth"
import { apiErrorBody, requireSameOriginForMutation } from "../lib/http"

export const accountApp = new Hono<{ Bindings: CloudflareBindings }>()

accountApp.use("/account", requireSameOriginForMutation)

accountApp.get("/account", async (c) => {
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

accountApp.put(
  "/account",
  bodyLimit({
    maxSize: 4 * 1024,
    onError: (c) =>
      c.json(apiErrorBody("BODY_TOO_LARGE", "Request body is too large"), 413),
  }),
  async (c) => {
    const auth = createAuth(c.env)
    const authSession = await auth.api.getSession({
      headers: c.req.raw.headers,
    })
    if (!authSession) {
      return c.json(
        apiErrorBody("UNAUTHORIZED", "Authentication is required"),
        401
      )
    }

    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json(
        apiErrorBody("INVALID_JSON", "Request body must be valid JSON"),
        400
      )
    }

    const parsed = v.safeParse(onboardingInputSchema, payload)
    if (!parsed.success) {
      return c.json(
        {
          ...apiErrorBody("INVALID_ONBOARDING_DATA", "Invalid onboarding data"),
          issues: v.flatten(parsed.issues).nested ?? {},
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

    const { studentId, displayName } = parsed.output
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
          ...apiErrorBody("ACCOUNT_EXISTS", "Account already exists"),
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
          ...apiErrorBody("ACCOUNT_CONFLICT", "Account could not be created"),
        },
        409
      )
    }

    return c.json({ ok: true as const }, 201)
  }
)
