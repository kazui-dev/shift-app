import { attendanceEventsResponseSchema } from "@workspace/shared/shifts"
import {
  attendanceEnvelopeSchema,
  assignmentReportEnvelopeSchema,
  shiftAttendanceResponseSchema,
  reportEventsResponseSchema,
  myAssignmentsResponseSchema,
} from "@workspace/shared/shifts"
import { queryOptions, skipToken } from "@tanstack/react-query"

import { japanDateStart, japanMonthRange } from "@/lib/japan-time"
import { apiJson } from "./client"

const assignmentMonthStaleTime = 5 * 60 * 1000

export type CalendarAssignment = Awaited<
  ReturnType<typeof getMyAssignments>
>["assignments"][number]

const getMyAssignments = (
  year: number,
  from: string,
  to: string,
  signal?: AbortSignal
) => {
  const query = new URLSearchParams({ from, to, year: String(year) })
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
  const range = japanMonthRange(month)
  return {
    from: new Date(range.from).toISOString(),
    to: new Date(range.to).toISOString(),
  }
}

export function assignmentMonthQuery(
  month: string,
  year: number | null,
  online = true
) {
  const range = assignmentMonthRange(month)
  return queryOptions({
    queryKey: ["assignments", "month", month, year] as const,
    queryFn:
      year === null
        ? skipToken
        : ({ signal }) => getMyAssignments(year, range.from, range.to, signal),
    staleTime: assignmentMonthStaleTime,
    refetchInterval: (query) =>
      online && query.state.status === "error" ? 30_000 : false,
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
    const from = japanDateStart(date)
    const to = from + 24 * 60 * 60 * 1000
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

export const checkIn = (assignmentId: string, locationConfirmed: boolean) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/attendance`,
    attendanceEnvelopeSchema,
    { method: "PUT", body: JSON.stringify({ locationConfirmed }) }
  )

export const submitAssignmentReport = (
  assignmentId: string,
  input: { kind: "late" | "absence"; message: string; eta?: string | null }
) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/report`,
    assignmentReportEnvelopeSchema,
    { method: "PUT", body: JSON.stringify(input) }
  )

export const getShiftAttendance = (activityId: string) =>
  apiJson(
    `/api/activities/${encodeURIComponent(activityId)}/attendance`,
    shiftAttendanceResponseSchema
  )
export const getReportEvents = (reportId: string) =>
  apiJson(
    `/api/reports/${encodeURIComponent(reportId)}/events`,
    reportEventsResponseSchema
  )
export const updateReportState = (
  reportId: string,
  status: "resolved" | "withdrawn",
  updatedAt: string
) =>
  apiJson(
    `/api/reports/${encodeURIComponent(reportId)}`,
    assignmentReportEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify({ status, updatedAt }) }
  )
export const correctAttendance = (
  assignmentId: string,
  checkedInAt: string,
  reason: string
) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/attendance`,
    attendanceEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify({ checkedInAt, reason }) }
  )

export const getAttendanceEvents = (id: string) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(id)}/attendance/events`,
    attendanceEventsResponseSchema
  )
