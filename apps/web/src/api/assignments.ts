import {
  attendanceEnvelopeSchema,
  assignmentMutationResponseSchema,
  assignmentReportEnvelopeSchema,
  assignmentReportsResponseSchema,
  myAssignmentsResponseSchema,
} from "@workspace/shared/shifts"
import { queryOptions } from "@tanstack/react-query"

import { apiJson, apiVoid } from "./client"

const assignmentMonthStaleTime = 5 * 60 * 1000

export type CalendarAssignment = Awaited<
  ReturnType<typeof getMyAssignments>
>["assignments"][number]

const getMyAssignments = (from: string, to: string, signal?: AbortSignal) => {
  const query = new URLSearchParams({ from, to })
  return apiJson(
    `/api/me/assignments?${query}`,
    myAssignmentsResponseSchema,
    signal ? { signal } : undefined
  )
}

export function assignmentMonthRange(month: string): {
  from: string
  to: string
} {
  const from = new Date(`${month}-01T00:00:00`)
  const to = new Date(from)
  to.setMonth(to.getMonth() + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function assignmentMonthQuery(month: string) {
  const range = assignmentMonthRange(month)
  return queryOptions({
    queryKey: ["assignments", "month", month] as const,
    queryFn: ({ signal }) => getMyAssignments(range.from, range.to, signal),
    staleTime: assignmentMonthStaleTime,
  })
}

export function assignmentsByDate(
  dates: string[],
  sources: Array<{ assignments: CalendarAssignment[] } | undefined>
): Map<string, CalendarAssignment[]> {
  const uniqueAssignments = new Map<string, CalendarAssignment>()
  for (const source of sources) {
    for (const assignment of source?.assignments ?? []) {
      uniqueAssignments.set(assignment.id, assignment)
    }
  }
  const assignments = [...uniqueAssignments.values()].sort(
    (left, right) =>
      Date.parse(left.startsAt) - Date.parse(right.startsAt) ||
      Date.parse(left.endsAt) - Date.parse(right.endsAt) ||
      left.id.localeCompare(right.id)
  )
  const result = new Map<string, CalendarAssignment[]>()
  for (const date of dates) {
    const from = new Date(`${date}T00:00:00`).getTime()
    const toDate = new Date(`${date}T00:00:00`)
    toDate.setDate(toDate.getDate() + 1)
    const to = toDate.getTime()
    result.set(
      date,
      assignments.filter(
        (assignment) =>
          Date.parse(assignment.startsAt) < to &&
          Date.parse(assignment.endsAt) > from
      )
    )
  }
  return result
}

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
