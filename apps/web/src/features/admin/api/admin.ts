import { yearMembershipEnvelopeSchema } from "@workspace/shared/shifts"
import {
  adminAuditLogsResponseSchema,
  adminUsersResponseSchema,
  adminMutationResponseSchema,
  type AdminUser,
} from "@workspace/shared/auth"

import { apiJson, apiVoid } from "../../../lib/http/client"

export const getAdminUsers = () =>
  apiJson("/api/admin/users", adminUsersResponseSchema)

export const getAdminAuditLogs = () =>
  apiJson("/api/admin/audit-logs", adminAuditLogsResponseSchema)

export const updateAdminAccessLevel = (
  memberId: string,
  input: { accessLevel: AdminUser["accessLevel"]; reason: string }
) =>
  apiJson(
    `/api/admin/users/${encodeURIComponent(memberId)}`,
    adminMutationResponseSchema,
    { method: "PATCH", body: JSON.stringify(input) }
  )

export const activateYearMembership = (year: number, memberId: string) =>
  apiJson(
    `/api/years/${year}/memberships/${encodeURIComponent(memberId)}`,
    yearMembershipEnvelopeSchema,
    { method: "PUT" }
  )

export const deactivateYearMembership = (year: number, memberId: string) =>
  apiVoid(`/api/years/${year}/memberships/${encodeURIComponent(memberId)}`, {
    method: "DELETE",
  })
