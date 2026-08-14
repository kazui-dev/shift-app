import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { members } from "@workspace/db/schema"
import {
  identityLinkDecisionInputSchema,
  revokeSessionsInputSchema,
  updateAccessLevelInputSchema,
} from "@workspace/shared/auth"

import { createAuth } from "./auth"

type AdminContextMember = {
  id: string
  userId: string
}

type AdminVariables = {
  adminMember: AdminContextMember
}

type AdminMemberRow = {
  id: string
  displayName: string
  studentId: string
  accessLevel: "system_admin" | "leader" | "member"
  isCurrentUser: number
  sessionCount: number
  createdAt: number
}

type AuditLogRow = {
  id: string
  actorType: "system_admin" | "cloudflare_operator"
  actorDisplayName: string | null
  action: string
  targetDisplayName: string | null
  targetStudentId: string | null
  details: string | null
  createdAt: number
}

type IdentityLinkRequestRow = {
  id: string
  requesterDisplayName: string
  requesterUserId: string
  targetMemberId: string
  targetUserId: string
  targetDisplayName: string
  targetStudentId: string
  createdAt: number
}

function parseAuditDetails(
  value: string | null
): Record<string, unknown> | null {
  if (!value) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Historical audit rows may predate structured details.
  }

  return null
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export const adminApp = new Hono<{
  Bindings: CloudflareBindings
  Variables: AdminVariables
}>()

adminApp.use(
  "*",
  bodyLimit({
    maxSize: 4 * 1024,
    onError: (c) => c.json({ error: "Request body is too large" }, 413),
  })
)

adminApp.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("Origin")
    if (origin !== c.env.BETTER_AUTH_URL) {
      return c.json({ error: "Forbidden origin" }, 403)
    }
  }

  const auth = createAuth(c.env)
  const authSession = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (!authSession) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const db = drizzle(c.env.shift_app)
  const [member] = await db
    .select({
      id: members.id,
      userId: members.userId,
      accessLevel: members.accessLevel,
    })
    .from(members)
    .where(eq(members.userId, authSession.user.id))
    .limit(1)

  if (!member || member.accessLevel !== "system_admin") {
    return c.json({ error: "Forbidden" }, 403)
  }

  c.set("adminMember", { id: member.id, userId: member.userId })
  c.header("Cache-Control", "private, no-store")
  await next()
})

adminApp.get("/members", async (c) => {
  const adminMember = c.get("adminMember")
  const result = await c.env.shift_app
    .prepare(
      `SELECT
        m.id AS id,
        m.display_name AS displayName,
        m.student_id AS studentId,
        m.access_level AS accessLevel,
        CASE WHEN m.user_id = ? THEN 1 ELSE 0 END AS isCurrentUser,
        (SELECT COUNT(*) FROM session s WHERE s.user_id = m.user_id) AS sessionCount,
        m.created_at AS createdAt
      FROM members m
      ORDER BY
        CASE m.access_level
          WHEN 'system_admin' THEN 0
          WHEN 'leader' THEN 1
          ELSE 2
        END,
        lower(m.display_name),
        m.created_at`
    )
    .bind(adminMember.userId)
    .all<AdminMemberRow>()

  return c.json({
    members: result.results.map((member) => ({
      ...member,
      isCurrentUser: member.isCurrentUser === 1,
    })),
  })
})

adminApp.get("/audit-logs", async (c) => {
  const result = await c.env.shift_app
    .prepare(
      `SELECT
        log.id AS id,
        log.actor_type AS actorType,
        actor.display_name AS actorDisplayName,
        log.action AS action,
        target.display_name AS targetDisplayName,
        target.student_id AS targetStudentId,
        log.details AS details,
        log.created_at AS createdAt
      FROM admin_audit_logs log
      LEFT JOIN members actor ON actor.user_id = log.actor_user_id
      LEFT JOIN members target ON target.id = log.target_member_id
      ORDER BY log.created_at DESC
      LIMIT 50`
    )
    .all<AuditLogRow>()

  return c.json({
    auditLogs: result.results.map((log) => ({
      ...log,
      details: parseAuditDetails(log.details),
    })),
  })
})

adminApp.get("/identity-link-requests", async (c) => {
  const adminMember = c.get("adminMember")
  const result = await c.env.shift_app
    .prepare(
      `SELECT
        request.id AS id,
        requester.name AS requesterDisplayName,
        request.requester_user_id AS requesterUserId,
        target.id AS targetMemberId,
        target.user_id AS targetUserId,
        target.display_name AS targetDisplayName,
        target.student_id AS targetStudentId,
        request.created_at AS createdAt
      FROM identity_link_requests request
      JOIN user requester ON requester.id = request.requester_user_id
      JOIN members target ON target.id = request.target_member_id
      WHERE request.status = 'pending'
      ORDER BY request.created_at ASC`
    )
    .all<IdentityLinkRequestRow>()

  return c.json({
    requests: result.results.map((request) => ({
      id: request.id,
      requesterDisplayName: request.requesterDisplayName,
      targetDisplayName: request.targetDisplayName,
      targetStudentId: request.targetStudentId,
      createdAt: request.createdAt,
      targetsCurrentAdmin: request.targetMemberId === adminMember.id,
    })),
  })
})

adminApp.patch("/members/:memberId/access-level", async (c) => {
  const parsed = updateAccessLevelInputSchema.safeParse(
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return c.json({ error: "Invalid role change" }, 400)
  }

  const targetMemberId = c.req.param("memberId")
  const adminMember = c.get("adminMember")
  const target = await c.env.shift_app
    .prepare(
      `SELECT id, user_id AS userId, access_level AS accessLevel
       FROM members
       WHERE id = ?`
    )
    .bind(targetMemberId)
    .first<{
      id: string
      userId: string
      accessLevel: "system_admin" | "leader" | "member"
    }>()

  if (!target) {
    return c.json({ error: "Member not found" }, 404)
  }
  if (target.id === adminMember.id) {
    return c.json({ error: "You cannot change your own role" }, 409)
  }
  if (target.accessLevel === parsed.data.accessLevel) {
    return c.json({ error: "Role is unchanged" }, 409)
  }

  const auditId = crypto.randomUUID()
  const now = Date.now()
  const details = JSON.stringify({
    from: target.accessLevel,
    to: parsed.data.accessLevel,
    reason: parsed.data.reason,
  })
  const [auditResult, updateResult] = await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(
        `INSERT INTO admin_audit_logs
          (id, actor_user_id, actor_type, action, target_member_id, details, created_at)
         SELECT ?, ?, 'system_admin', 'member.access_level.updated', m.id, ?, ?
         FROM members m
         WHERE m.id = ?
           AND m.user_id <> ?
           AND m.access_level <> ?
           AND (
             m.access_level <> 'system_admin'
             OR ? = 'system_admin'
             OR (SELECT COUNT(*) FROM members WHERE access_level = 'system_admin') > 1
           )`
      )
      .bind(
        auditId,
        adminMember.userId,
        details,
        now,
        targetMemberId,
        adminMember.userId,
        parsed.data.accessLevel,
        parsed.data.accessLevel
      ),
    c.env.shift_app
      .prepare(
        `UPDATE members
         SET access_level = ?, updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM admin_audit_logs
             WHERE id = ? AND target_member_id = members.id
           )`
      )
      .bind(parsed.data.accessLevel, now, targetMemberId, auditId),
  ])

  if (auditResult.meta.changes !== 1 || updateResult.meta.changes !== 1) {
    return c.json(
      { error: "Role change was rejected; keep at least one system admin" },
      409
    )
  }

  return c.json({ ok: true as const })
})

adminApp.post("/members/:memberId/revoke-sessions", async (c) => {
  const parsed = revokeSessionsInputSchema.safeParse(await readJson(c.req.raw))
  if (!parsed.success) {
    return c.json({ error: "Invalid session revocation" }, 400)
  }

  const targetMemberId = c.req.param("memberId")
  const adminMember = c.get("adminMember")
  const auditId = crypto.randomUUID()
  const now = Date.now()
  const details = JSON.stringify({ reason: parsed.data.reason })
  const [auditResult, deleteResult] = await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(
        `INSERT INTO admin_audit_logs
          (id, actor_user_id, actor_type, action, target_member_id, details, created_at)
         SELECT ?, ?, 'system_admin', 'member.sessions.revoked', m.id, ?, ?
         FROM members m
         WHERE m.id = ?`
      )
      .bind(auditId, adminMember.userId, details, now, targetMemberId),
    c.env.shift_app
      .prepare(
        `DELETE FROM session
         WHERE user_id = (SELECT user_id FROM members WHERE id = ?)
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(targetMemberId, auditId),
  ])

  if (auditResult.meta.changes !== 1) {
    return c.json({ error: "Member not found" }, 404)
  }

  return c.json({
    ok: true as const,
    revokedSessions: deleteResult.meta.changes,
  })
})

adminApp.post("/identity-link-requests/:requestId/decision", async (c) => {
  const parsed = identityLinkDecisionInputSchema.safeParse(
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return c.json({ error: "Invalid identity link decision" }, 400)
  }

  const requestId = c.req.param("requestId")
  const adminMember = c.get("adminMember")
  const request = await c.env.shift_app
    .prepare(
      `SELECT
        request.id AS id,
        request.requester_user_id AS requesterUserId,
        target.id AS targetMemberId,
        target.user_id AS targetUserId
       FROM identity_link_requests request
       JOIN members target ON target.id = request.target_member_id
       WHERE request.id = ? AND request.status = 'pending'`
    )
    .bind(requestId)
    .first<
      Pick<
        IdentityLinkRequestRow,
        "id" | "requesterUserId" | "targetMemberId" | "targetUserId"
      >
    >()

  if (!request) {
    return c.json({ error: "Pending request not found" }, 404)
  }
  if (
    parsed.data.decision === "approved" &&
    request.targetMemberId === adminMember.id
  ) {
    return c.json(
      { error: "You cannot approve identity recovery for your own account" },
      409
    )
  }

  const auditId = crypto.randomUUID()
  const now = Date.now()
  const action = `identity_link_request.${parsed.data.decision}`
  const details = JSON.stringify({ reason: parsed.data.reason })

  if (parsed.data.decision === "rejected") {
    const [auditResult, updateResult] = await c.env.shift_app.batch([
      c.env.shift_app
        .prepare(
          `INSERT INTO admin_audit_logs
            (id, actor_user_id, actor_type, action, target_member_id, details, created_at)
           SELECT ?, ?, 'system_admin', ?, request.target_member_id, ?, ?
           FROM identity_link_requests request
           WHERE request.id = ? AND request.status = 'pending'`
        )
        .bind(auditId, adminMember.userId, action, details, now, requestId),
      c.env.shift_app
        .prepare(
          `UPDATE identity_link_requests
           SET status = 'rejected', decided_by = ?, decided_at = ?
           WHERE id = ?
             AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
        )
        .bind(adminMember.id, now, requestId, auditId),
    ])

    if (auditResult.meta.changes !== 1 || updateResult.meta.changes !== 1) {
      return c.json({ error: "Request is no longer pending" }, 409)
    }

    return c.json({ ok: true as const })
  }

  const statements = [
    c.env.shift_app
      .prepare(
        `INSERT INTO admin_audit_logs
          (id, actor_user_id, actor_type, action, target_member_id, details, created_at)
         SELECT ?, ?, 'system_admin', ?, request.target_member_id, ?, ?
         FROM identity_link_requests request
         JOIN members target ON target.id = request.target_member_id
         WHERE request.id = ?
           AND request.status = 'pending'
           AND target.id <> ?
           AND NOT EXISTS (
             SELECT 1 FROM members WHERE user_id = request.requester_user_id
           )
           AND (
             SELECT COUNT(*) FROM account
             WHERE user_id = request.requester_user_id AND provider_id = 'discord'
           ) = 1
           AND EXISTS (
             SELECT 1 FROM affiliation_verifications affiliation
             WHERE affiliation.user_id = request.requester_user_id
               AND affiliation.provider_id = 'discord'
               AND affiliation.organization_id = ?
           )`
      )
      .bind(
        auditId,
        adminMember.userId,
        action,
        details,
        now,
        requestId,
        adminMember.id,
        c.env.DISCORD_GUILD_ID
      ),
    c.env.shift_app
      .prepare(
        `DELETE FROM account
         WHERE user_id = ? AND provider_id = 'discord'
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(request.targetUserId, auditId),
    c.env.shift_app
      .prepare(
        `DELETE FROM affiliation_verifications
         WHERE user_id = ? AND provider_id = 'discord'
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(request.targetUserId, auditId),
    c.env.shift_app
      .prepare(
        `UPDATE account
         SET user_id = ?, updated_at = ?
         WHERE user_id = ? AND provider_id = 'discord'
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(request.targetUserId, now, request.requesterUserId, auditId),
    c.env.shift_app
      .prepare(
        `UPDATE affiliation_verifications
         SET user_id = ?, updated_at = ?, verified_at = ?
         WHERE user_id = ? AND provider_id = 'discord'
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(request.targetUserId, now, now, request.requesterUserId, auditId),
    c.env.shift_app
      .prepare(
        `DELETE FROM session
         WHERE user_id IN (?, ?)
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(request.requesterUserId, request.targetUserId, auditId),
    c.env.shift_app
      .prepare(
        `UPDATE identity_link_requests
         SET status = 'approved', decided_by = ?, decided_at = ?
         WHERE id = ?
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(adminMember.id, now, requestId, auditId),
  ]
  const results = await c.env.shift_app.batch(statements)

  if (
    results[0]?.meta.changes !== 1 ||
    results[3]?.meta.changes !== 1 ||
    results[4]?.meta.changes !== 1 ||
    results[6]?.meta.changes !== 1
  ) {
    return c.json(
      { error: "Identity recovery conditions are no longer satisfied" },
      409
    )
  }

  return c.json({ ok: true as const })
})
