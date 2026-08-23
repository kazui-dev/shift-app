import { Hono } from "hono"
import * as v from "valibot"

import {
  identityLinkDecisionInputSchema,
  revokeSessionsInputSchema,
  updateAccessLevelInputSchema,
} from "@workspace/shared/auth"

import { apiErrorBody, readJson } from "../../lib/http"
import type { AdminEnv } from "./context"

type IdentityLinkDecisionRow = {
  id: string
  requesterUserId: string
  targetMemberId: string
  targetUserId: string
}

export const adminCommandsApp = new Hono<AdminEnv>()

adminCommandsApp.patch("/members/:memberId", async (c) => {
  const parsed = v.safeParse(
    updateAccessLevelInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return c.json(
      apiErrorBody("INVALID_ROLE_CHANGE", "Invalid role change"),
      400
    )
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
    return c.json(apiErrorBody("MEMBER_NOT_FOUND", "Member not found"), 404)
  }
  if (target.id === adminMember.id) {
    return c.json(
      apiErrorBody("SELF_ROLE_CHANGE", "You cannot change your own role"),
      409
    )
  }
  if (target.accessLevel === parsed.output.accessLevel) {
    return c.json(apiErrorBody("ROLE_UNCHANGED", "Role is unchanged"), 409)
  }

  const auditId = crypto.randomUUID()
  const now = Date.now()
  const details = JSON.stringify({
    from: target.accessLevel,
    to: parsed.output.accessLevel,
    reason: parsed.output.reason,
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
        parsed.output.accessLevel,
        parsed.output.accessLevel
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
      .bind(parsed.output.accessLevel, now, targetMemberId, auditId),
  ])

  if (
    !auditResult ||
    !updateResult ||
    auditResult.meta.changes !== 1 ||
    updateResult.meta.changes !== 1
  ) {
    return c.json(
      apiErrorBody(
        "LAST_SYSTEM_ADMIN",
        "Role change was rejected; keep at least one system admin"
      ),
      409
    )
  }

  return c.json({ ok: true as const })
})

adminCommandsApp.post("/members/:memberId/revoke-sessions", async (c) => {
  const parsed = v.safeParse(
    revokeSessionsInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return c.json(
      apiErrorBody("INVALID_SESSION_REVOCATION", "Invalid session revocation"),
      400
    )
  }

  const targetMemberId = c.req.param("memberId")
  const adminMember = c.get("adminMember")
  const auditId = crypto.randomUUID()
  const now = Date.now()
  const details = JSON.stringify({ reason: parsed.output.reason })
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

  if (!auditResult || !deleteResult || auditResult.meta.changes !== 1) {
    return c.json(apiErrorBody("MEMBER_NOT_FOUND", "Member not found"), 404)
  }

  return c.json({
    ok: true as const,
    revokedSessions: deleteResult.meta.changes,
  })
})

adminCommandsApp.patch("/identity-link-requests/:requestId", async (c) => {
  const parsed = v.safeParse(
    identityLinkDecisionInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return c.json(
      apiErrorBody(
        "INVALID_IDENTITY_LINK_DECISION",
        "Invalid identity link decision"
      ),
      400
    )
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
    .first<IdentityLinkDecisionRow>()

  if (!request) {
    return c.json(
      apiErrorBody("LINK_REQUEST_NOT_FOUND", "Pending request not found"),
      404
    )
  }
  if (
    parsed.output.decision === "approved" &&
    request.targetMemberId === adminMember.id
  ) {
    return c.json(
      apiErrorBody(
        "SELF_IDENTITY_RECOVERY",
        "You cannot approve identity recovery for your own account"
      ),
      409
    )
  }

  const auditId = crypto.randomUUID()
  const now = Date.now()
  const action = `identity_link_request.${parsed.output.decision}`
  const details = JSON.stringify({ reason: parsed.output.reason })

  if (parsed.output.decision === "rejected") {
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

    if (
      !auditResult ||
      !updateResult ||
      auditResult.meta.changes !== 1 ||
      updateResult.meta.changes !== 1
    ) {
      return c.json(
        apiErrorBody(
          "LINK_REQUEST_NOT_PENDING",
          "Request is no longer pending"
        ),
        409
      )
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
      apiErrorBody(
        "IDENTITY_RECOVERY_CONFLICT",
        "Identity recovery conditions are no longer satisfied"
      ),
      409
    )
  }

  return c.json({ ok: true as const })
})
