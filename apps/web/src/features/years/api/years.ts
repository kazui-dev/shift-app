import {
  operatingYearEnvelopeSchema,
  displayYearResponseSchema,
  rosterResponseSchema,
  yearMembershipEnvelopeSchema,
  yearMembershipsResponseSchema,
  yearRoleEnvelopeSchema,
  yearRolesResponseSchema,
  yearsResponseSchema,
  yearSettingsResponseSchema,
  type ShiftPermission,
} from "@workspace/shared/shifts"

import { apiJson, apiVoid } from "../../../lib/http/client"

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

export const createYear = (input: { year: number }) =>
  apiJson("/api/years", operatingYearEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const setDefaultYear = (defaultYear: number) =>
  apiJson("/api/year-settings", yearSettingsResponseSchema, {
    method: "PUT",
    body: JSON.stringify({ defaultYear }),
  })

export const createYearRole = (
  year: number,
  input: { name: string; color: string; permissions: ShiftPermission[] }
) =>
  apiJson(`/api/years/${year}/roles`, yearRoleEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const getDisplayYear = () =>
  apiJson("/api/me/display-year", displayYearResponseSchema)
export const updateRole = (
  id: string,
  input: { name: string; color: string; permissions: ShiftPermission[] }
) =>
  apiVoid(`/api/roles/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
export const changeMemberRoles = (
  year: number,
  input: { memberIds: string[]; addRoleIds: string[]; removeRoleIds: string[] }
) =>
  apiVoid(`/api/years/${year}/memberships`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })

export const reorderRoles = (year: number, roleIds: string[]) =>
  apiVoid(`/api/years/${year}/role-order`, {
    method: "PUT",
    body: JSON.stringify({ roleIds }),
  })

export const deleteRole = (id: string) =>
  apiVoid(`/api/roles/${encodeURIComponent(id)}`, { method: "DELETE" })
