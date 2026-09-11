import {
  adminAuditLogsResponseSchema,
  adminUsersResponseSchema,
  adminMutationResponseSchema,
  identityLinkRequestsResponseSchema,
  type AdminUser,
} from "@workspace/shared/auth"

import { apiJson } from "./client"

export const getAdminUsers = () =>
  apiJson("/api/admin/users", adminUsersResponseSchema)

export const getAdminAuditLogs = () =>
  apiJson("/api/admin/audit-logs", adminAuditLogsResponseSchema)

export const getDiscordLinkRequests = () =>
  apiJson(
    "/api/admin/identity-link-requests",
    identityLinkRequestsResponseSchema
  )

export const updateAdminAccessLevel = (
  memberId: string,
  input: { accessLevel: AdminUser["accessLevel"]; reason: string }
) =>
  apiJson(
    `/api/admin/users/${encodeURIComponent(memberId)}`,
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
