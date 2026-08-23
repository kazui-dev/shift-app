import {
  adminAuditLogsResponseSchema,
  adminMembersResponseSchema,
  adminMutationResponseSchema,
  identityLinkRequestsResponseSchema,
  type AdminMember,
} from "@workspace/shared/auth"

import { apiJson } from "./client"

export const getAdminMembers = () =>
  apiJson("/api/admin/members", adminMembersResponseSchema)

export const getAdminAuditLogs = () =>
  apiJson("/api/admin/audit-logs", adminAuditLogsResponseSchema)

export const getDiscordLinkRequests = () =>
  apiJson(
    "/api/admin/identity-link-requests",
    identityLinkRequestsResponseSchema
  )

export const updateAdminAccessLevel = (
  memberId: string,
  input: { accessLevel: AdminMember["accessLevel"]; reason: string }
) =>
  apiJson(
    `/api/admin/members/${encodeURIComponent(memberId)}`,
    adminMutationResponseSchema,
    { method: "PATCH", body: JSON.stringify(input) }
  )

export const decideDiscordLinkRequest = (
  requestId: string,
  input: { decision: "approved" | "rejected"; reason: string }
) =>
  apiJson(
    `/api/admin/identity-link-requests/${encodeURIComponent(requestId)}`,
    adminMutationResponseSchema,
    { method: "PATCH", body: JSON.stringify(input) }
  )
