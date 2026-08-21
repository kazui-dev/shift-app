import { Hono } from "hono"

import type { AdminEnv } from "./context"

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
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return { ...parsed }
    }
  } catch {
    // Historical audit rows may predate structured details.
  }
  return null
}

export const adminQueriesApp = new Hono<AdminEnv>()

adminQueriesApp.get("/members", async (c) => {
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

adminQueriesApp.get("/audit-logs", async (c) => {
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

adminQueriesApp.get("/recovery-requests", async (c) => {
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
