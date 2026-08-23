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

export const getRecoveryRequests = () =>
  apiJson("/api/admin/recovery-requests", identityLinkRequestsResponseSchema)

export const getAdminAuditLogs = () =>
  apiJson("/api/admin/audit-logs", adminAuditLogsResponseSchema)

export const updateAdminAccessLevel = (
  memberId: string,
  input: { accessLevel: AdminMember["accessLevel"]; reason: string }
) =>
  apiJson(
    `/api/admin/members/${encodeURIComponent(memberId)}`,
    adminMutationResponseSchema,
    { method: "PATCH", body: JSON.stringify(input) }
  )

export const decideRecoveryRequest = (
  requestId: string,
  input: { decision: "approved" | "rejected"; reason: string }
) =>
  apiJson(
    `/api/admin/recovery-requests/${encodeURIComponent(requestId)}`,
    adminMutationResponseSchema,
    { method: "PATCH", body: JSON.stringify(input) }
  )
