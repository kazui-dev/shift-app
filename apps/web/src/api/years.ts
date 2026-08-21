import {
  operatingYearEnvelopeSchema,
  roleMembershipResponseSchema,
  rosterResponseSchema,
  yearMembershipEnvelopeSchema,
  yearMembershipsResponseSchema,
  yearRoleEnvelopeSchema,
  yearRolesResponseSchema,
  yearsResponseSchema,
  type ShiftPermission,
} from "@workspace/shared/shifts"

import { apiJson, apiVoid } from "./client"

export const getYears = () => apiJson("/api/years", yearsResponseSchema)

export const getRoster = (year: number) =>
  apiJson(`/api/years/${year}/roster`, rosterResponseSchema)

export const getYearMemberships = (year: number) =>
  apiJson(`/api/years/${year}/memberships`, yearMembershipsResponseSchema)

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

export const getYearRoles = (year: number) =>
  apiJson(`/api/years/${year}/roles`, yearRolesResponseSchema)

export const createYear = (input: {
  year: number
  status: "draft" | "active" | "archived"
}) =>
  apiJson("/api/years", operatingYearEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const updateYear = (
  year: number,
  input: { status: "draft" | "active" | "archived" }
) =>
  apiJson(`/api/years/${year}`, operatingYearEnvelopeSchema, {
    method: "PATCH",
    body: JSON.stringify(input),
  })

export const createYearRole = (
  year: number,
  input: { name: string; color: string; permissions: ShiftPermission[] }
) =>
  apiJson(`/api/years/${year}/roles`, yearRoleEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const assignYearRole = (roleId: string, memberId: string) =>
  apiJson(
    `/api/roles/${encodeURIComponent(roleId)}/members/${encodeURIComponent(memberId)}`,
    roleMembershipResponseSchema,
    { method: "PUT" }
  )

export const removeYearRole = (roleId: string, memberId: string) =>
  apiVoid(
    `/api/roles/${encodeURIComponent(roleId)}/members/${encodeURIComponent(memberId)}`,
    { method: "DELETE" }
  )
