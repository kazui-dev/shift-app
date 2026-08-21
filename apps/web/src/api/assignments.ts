import {
  attendanceEnvelopeSchema,
  assignmentMutationResponseSchema,
  assignmentReportEnvelopeSchema,
  assignmentReportsResponseSchema,
} from "@workspace/shared/shifts"

import { apiJson, apiVoid } from "./client"

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
    `/api/assignments/${encodeURIComponent(assignmentId)}/attendance`,
    attendanceEnvelopeSchema,
    { method: "PUT" }
  )

export const submitAssignmentReport = (
  assignmentId: string,
  input: { kind: "late" | "absence"; message: string }
) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/report`,
    assignmentReportEnvelopeSchema,
    { method: "PUT", body: JSON.stringify(input) }
  )

export const getAssignmentReports = (year: number) =>
  apiJson(`/api/years/${year}/reports`, assignmentReportsResponseSchema)

export const resolveAssignmentReport = (reportId: string) =>
  apiJson(
    `/api/reports/${encodeURIComponent(reportId)}`,
    assignmentReportEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify({ status: "resolved" }) }
  )
