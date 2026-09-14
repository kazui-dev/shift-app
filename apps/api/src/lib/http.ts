import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import type { Context, MiddlewareHandler } from "hono"
import { bodyLimit } from "hono/body-limit"

import { chatImageLimits } from "@workspace/shared/communications"
import { appUsers } from "@workspace/db/schema"

import { createAuth } from "../auth"
import { apiError, errorBody, errors } from "./errors"

export type MemberContext = {
  id: string
  userId: string
  displayName: string
  accessLevel: "system_admin" | "leader" | "member"
}

type SameOriginEnv = {
  Bindings: Pick<CloudflareBindings, "BETTER_AUTH_URL">
}

export type ApiEnv = {
  Bindings: CloudflareBindings
  Variables: {
    member: MemberContext
  }
}

export const requireMember: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return apiError(c, errors.unauthorized)
  }

  const db = drizzle(c.env.shift_app)
  const [member] = await db
    .select({
      id: appUsers.id,
      userId: appUsers.userId,
      displayName: appUsers.displayName,
      accessLevel: appUsers.accessLevel,
    })
    .from(appUsers)
    .where(eq(appUsers.userId, session.user.id))
    .limit(1)

  if (!member) {
    return apiError(c, errors.onboardingRequired)
  }

  c.set("member", member)
  c.header("Cache-Control", "private, no-store")
  return next()
}

export const requireSameOriginForMutation: MiddlewareHandler<
  SameOriginEnv
> = async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    if (c.req.header("Origin") !== c.env.BETTER_AUTH_URL) {
      return c.json(errorBody(errors.forbiddenOrigin), 403)
    }
  }
  return next()
}

export function requireSystemAdmin(c: Context<ApiEnv>): Response | null {
  if (c.get("member").accessLevel !== "system_admin") {
    return apiError(c, errors.systemAdminRequired)
  }
  return null
}

export function parseYear(value: string): number | null {
  if (!/^\d{4}$/.test(value)) {
    return null
  }
  const year = Number(value)
  return year >= 2000 && year <= 2100 ? year : null
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** A response only the requesting member may see, never stored or sniffed. */
export function privateResponse(
  body: BodyInit | null,
  headers: Record<string, string>
) {
  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
      ...headers,
    },
  })
}

export function toIso(value: number): string {
  return new Date(value).toISOString()
}

/** Requests that carry an image: a new upload, or the original of a display copy. */
const carriesImage = (method: string, path: string) =>
  (method === "POST" &&
    /^\/api\/chat\/rooms\/[^/]+\/attachments$/.test(path)) ||
  (method === "PUT" &&
    /^\/api\/chat\/rooms\/[^/]+\/attachments\/[^/]+\/original$/.test(path))

/** Bounds every API body: an image up to the chat's limit, anything else to 32KB. */
export const limitRequestBody: MiddlewareHandler = (c, next) =>
  bodyLimit({
    maxSize: carriesImage(c.req.method, c.req.path)
      ? chatImageLimits.bytes
      : 32 * 1024,
    onError: (context) => apiError(context, errors.bodyTooLarge),
  })(c, next)
