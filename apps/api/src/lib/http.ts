import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import type { Context, MiddlewareHandler } from "hono"

import { members } from "@workspace/db/schema"
import type { ShiftPermission } from "@workspace/shared/shifts"

import { createAuth } from "../auth"

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

export function apiErrorBody(code: string, message: string) {
  return { error: { code, message } }
}

export function apiError(
  c: Context<ApiEnv>,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 500,
  code: string,
  message: string
) {
  return c.json(apiErrorBody(code, message), status)
}

export const requireMember: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return apiError(c, 401, "UNAUTHORIZED", "Authentication is required")
  }

  const db = drizzle(c.env.shift_app)
  const [member] = await db
    .select({
      id: members.id,
      userId: members.userId,
      displayName: members.displayName,
      accessLevel: members.accessLevel,
    })
    .from(members)
    .where(eq(members.userId, session.user.id))
    .limit(1)

  if (!member) {
    return apiError(c, 403, "ONBOARDING_REQUIRED", "Onboarding is required")
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
      return c.json(
        apiErrorBody("FORBIDDEN_ORIGIN", "Request origin is not allowed"),
        403
      )
    }
  }
  return next()
}

export function requireSystemAdmin(c: Context<ApiEnv>): Response | null {
  if (c.get("member").accessLevel !== "system_admin") {
    return apiError(
      c,
      403,
      "FORBIDDEN",
      "System administrator access is required"
    )
  }
  return null
}

export async function canManageShifts(
  env: CloudflareBindings,
  member: MemberContext,
  year: number
): Promise<boolean> {
  if (member.accessLevel === "system_admin") {
    return true
  }

  const row = await env.shift_app
    .prepare(
      `SELECT 1 AS allowed
       FROM member_year_roles member_role
       JOIN year_roles role ON role.id = member_role.role_id
       JOIN year_memberships year_membership
         ON year_membership.year = role.year
        AND year_membership.member_id = member_role.member_id
        AND year_membership.status = 'active'
       JOIN year_role_permissions permission ON permission.role_id = role.id
       WHERE member_role.member_id = ?
         AND role.year = ?
         AND permission.permission = ?
       LIMIT 1`
    )
    .bind(member.id, year, "shift.manage" satisfies ShiftPermission)
    .first<{ allowed: number }>()

  return row?.allowed === 1
}

export async function canAccessYear(
  env: CloudflareBindings,
  member: MemberContext,
  year: number
): Promise<boolean> {
  if (member.accessLevel === "system_admin") return true
  return hasActiveYearMembership(env, member.id, year)
}

export async function hasActiveYearMembership(
  env: CloudflareBindings,
  memberId: string,
  year: number
): Promise<boolean> {
  const row = await env.shift_app
    .prepare(
      `SELECT 1 AS allowed FROM year_memberships
       WHERE year = ? AND member_id = ? AND status = 'active'`
    )
    .bind(year, memberId)
    .first<{ allowed: number }>()
  return row?.allowed === 1
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

export function toIso(value: number): string {
  return new Date(value).toISOString()
}
