import { Hono } from "hono"
import * as v from "valibot"

import {
  identityLinkDecisionInputSchema,
  revokeSessionsInputSchema,
  updateAccessLevelInputSchema,
} from "@workspace/shared/auth"

import { apiError, errors } from "../../lib/errors"
import { readJson } from "../../lib/http"
import type { AdminEnv } from "./context"
import { announce } from "../announce"

type IdentityLinkDecisionRow = {
  id: string
  requesterUserId: string
  targetMemberId: string
  targetUserId: string
}

export const adminCommandsApp = new Hono<AdminEnv>()

adminCommandsApp.patch(
  "/users/:memberId",
  announce({ type: "access_changed" }),
  async (c) => {
    const parsed = v.safeParse(
      updateAccessLevelInputSchema,
      await readJson(c.req.raw)
    )
    if (!parsed.success) {
      return apiError(c, errors.invalidRoleChange)
    }

    const targetMemberId = c.req.param("memberId")
    const adminUser = c.get("adminUser")
    const target = await c.env.shift_app
      .prepare(
        `SELECT id, user_id AS userId, access_level AS accessLevel
       FROM app_users
       WHERE id = ?`
      )
      .bind(targetMemberId)
      .first<{
        id: string
        userId: string
        accessLevel: "system_admin" | "leader" | "member"
      }>()

    if (!target) {
      return apiError(c, errors.memberNotFound)
    }
    if (target.id === adminUser.id) {
      return apiError(c, errors.selfRoleChange)
    }
    if (target.accessLevel === parsed.output.accessLevel) {
      return apiError(c, errors.roleUnchanged)
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
         FROM app_users m
         WHERE m.id = ?
           AND m.user_id <> ?
           AND m.access_level <> ?
           AND (
             m.access_level <> 'system_admin'
             OR ? = 'system_admin'
             OR (SELECT COUNT(*) FROM app_users WHERE access_level = 'system_admin') > 1
           )`
        )
        .bind(
          auditId,
          adminUser.userId,
          details,
          now,
          targetMemberId,
          adminUser.userId,
          parsed.output.accessLevel,
          parsed.output.accessLevel
        ),
      c.env.shift_app
        .prepare(
          `UPDATE app_users
         SET access_level = ?, updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM admin_audit_logs
             WHERE id = ? AND target_member_id = app_users.id
           ) RETURNING id`
        )
        .bind(parsed.output.accessLevel, now, targetMemberId, auditId),
    ])

    if (
      !auditResult ||
      !updateResult ||
      auditResult.meta.changes !== 1 ||
      !updateResult.results.length
    ) {
      return apiError(c, errors.lastSystemAdmin)
    }

    return c.json({ ok: true as const })
  }
)

adminCommandsApp.post("/users/:memberId/revoke-sessions", async (c) => {
  const parsed = v.safeParse(
    revokeSessionsInputSchema,
    await readJson(c.req.raw)
  )
  if (!parsed.success) {
    return apiError(c, errors.invalidSessionRevocation)
  }

  const targetMemberId = c.req.param("memberId")
  const adminUser = c.get("adminUser")
  const auditId = crypto.randomUUID()
  const now = Date.now()
  const details = JSON.stringify({ reason: parsed.output.reason })
  const [auditResult, deleteResult] = await c.env.shift_app.batch([
    c.env.shift_app
      .prepare(
        `INSERT INTO admin_audit_logs
          (id, actor_user_id, actor_type, action, target_member_id, details, created_at)
         SELECT ?, ?, 'system_admin', 'member.sessions.revoked', m.id, ?, ?
         FROM app_users m
         WHERE m.id = ?`
      )
      .bind(auditId, adminUser.userId, details, now, targetMemberId),
    c.env.shift_app
      .prepare(
        `DELETE FROM session
         WHERE user_id = (SELECT user_id FROM app_users WHERE id = ?)
           AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
      )
      .bind(targetMemberId, auditId),
  ])

  if (!auditResult || !deleteResult || auditResult.meta.changes !== 1) {
    return apiError(c, errors.memberNotFound)
  }

  return c.json({
    ok: true as const,
    revokedSessions: deleteResult.meta.changes,
  })
})

adminCommandsApp.patch(
  "/identity-link-requests/:requestId",
  announce({ type: "access_changed" }),
  async (c) => {
    const parsed = v.safeParse(
      identityLinkDecisionInputSchema,
      await readJson(c.req.raw)
    )
    if (!parsed.success) {
      return apiError(c, errors.invalidIdentityLinkDecision)
    }

    const requestId = c.req.param("requestId")
    const adminUser = c.get("adminUser")
    const request = await c.env.shift_app
      .prepare(
        `SELECT
        request.id AS id,
        request.requester_user_id AS requesterUserId,
        target.id AS targetMemberId,
        target.user_id AS targetUserId
       FROM identity_link_requests request
       JOIN app_users target ON target.id = request.target_member_id
       WHERE request.id = ? AND request.status = 'pending'`
      )
      .bind(requestId)
      .first<IdentityLinkDecisionRow>()

    if (!request) {
      return apiError(c, errors.linkRequestNotFound)
    }
    if (
      parsed.output.decision === "approved" &&
      request.targetMemberId === adminUser.id
    ) {
      return apiError(c, errors.selfIdentityRecovery)
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
          .bind(auditId, adminUser.userId, action, details, now, requestId),
        c.env.shift_app
          .prepare(
            `UPDATE identity_link_requests
           SET status = 'rejected', decided_by = ?, decided_at = ?
           WHERE id = ?
             AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE id = ?)`
          )
          .bind(adminUser.id, now, requestId, auditId),
      ])

      if (
        !auditResult ||
        !updateResult ||
        auditResult.meta.changes !== 1 ||
        updateResult.meta.changes !== 1
      ) {
        return apiError(c, errors.linkRequestNotPending)
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
         JOIN app_users target ON target.id = request.target_member_id
         WHERE request.id = ?
           AND request.status = 'pending'
           AND target.id <> ?
           AND NOT EXISTS (
             SELECT 1 FROM app_users WHERE user_id = request.requester_user_id
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
          adminUser.userId,
          action,
          details,
          now,
          requestId,
          adminUser.id,
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
        .bind(adminUser.id, now, requestId, auditId),
    ]
    const results = await c.env.shift_app.batch(statements)

    if (
      results[0]?.meta.changes !== 1 ||
      results[3]?.meta.changes !== 1 ||
      results[4]?.meta.changes !== 1 ||
      results[6]?.meta.changes !== 1
    ) {
      return apiError(c, errors.identityRecoveryConflict)
    }

    return c.json({ ok: true as const })
  }
)
