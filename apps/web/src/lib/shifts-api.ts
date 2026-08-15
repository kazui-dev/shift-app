import {
  activitiesResponseSchema,
  attendanceEnvelopeSchema,
  activityDetailResponseSchema,
  activityEnvelopeSchema,
  assignmentMutationResponseSchema,
  assignmentReportEnvelopeSchema,
  assignmentReportsResponseSchema,
  availabilityEnvelopeSchema,
  availabilitySubmissionsResponseSchema,
  operatingYearEnvelopeSchema,
  roleMembershipResponseSchema,
  timelineResponseSchema,
  yearMembersResponseSchema,
  yearMembershipEnvelopeSchema,
  yearMembershipsResponseSchema,
  yearRoleEnvelopeSchema,
  yearRolesResponseSchema,
  yearsResponseSchema,
  type ShiftPermission,
} from "@workspace/shared/shifts"

import { apiJson, apiVoid } from "./api"

export const getYears = () => apiJson("/api/years", yearsResponseSchema)

export const getActivities = (year: number) =>
  apiJson(`/api/years/${year}/activities`, activitiesResponseSchema)

export const getActivity = (activityId: string) =>
  apiJson(
    `/api/activities/${encodeURIComponent(activityId)}`,
    activityDetailResponseSchema
  )

export const getYearMembers = (year: number) =>
  apiJson(`/api/years/${year}/members`, yearMembersResponseSchema)

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

export const getAvailability = (year: number) =>
  apiJson(`/api/years/${year}/availability`, availabilityEnvelopeSchema)

export const getAvailabilitySubmissions = (year: number) =>
  apiJson(
    `/api/years/${year}/availability-submissions`,
    availabilitySubmissionsResponseSchema
  )

export const getTimeline = (from: string, to: string) => {
  const query = new URLSearchParams({ from, to })
  return apiJson(`/api/me/timeline?${query}`, timelineResponseSchema)
}

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

export const replaceAvailability = (
  year: number,
  input: {
    status: "draft" | "submitted"
    windows: Array<{ startsAt: string; endsAt: string }>
  }
) =>
  apiJson(`/api/years/${year}/availability`, availabilityEnvelopeSchema, {
    method: "PUT",
    body: JSON.stringify(input),
  })

export const createActivity = (
  year: number,
  input: {
    name: string
    place: string
    activityType: string
    startsAt: string
    endsAt: string
    color: string
    notes: string | null
  }
) =>
  apiJson(`/api/years/${year}/activities`, activityEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const createAssignment = (
  activityId: string,
  input: { memberId: string; notes: string | null }
) =>
  apiJson(
    `/api/activities/${encodeURIComponent(activityId)}/assignments`,
    assignmentMutationResponseSchema,
    { method: "POST", body: JSON.stringify(input) }
  )

export const cancelAssignment = (assignmentId: string) =>
  apiVoid(`/api/assignments/${encodeURIComponent(assignmentId)}`, {
    method: "DELETE",
  })

export const checkIn = (assignmentId: string) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/check-in`,
    attendanceEnvelopeSchema,
    { method: "POST" }
  )

export const submitAssignmentReport = (
  assignmentId: string,
  input: { kind: "late" | "absence"; message: string }
) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/report`,
    assignmentReportEnvelopeSchema,
    { method: "POST", body: JSON.stringify(input) }
  )

export const getAssignmentReports = (year: number) =>
  apiJson(`/api/years/${year}/reports`, assignmentReportsResponseSchema)

export const resolveAssignmentReport = (reportId: string) =>
  apiJson(
    `/api/reports/${encodeURIComponent(reportId)}/resolve`,
    assignmentReportEnvelopeSchema,
    { method: "POST" }
  )
