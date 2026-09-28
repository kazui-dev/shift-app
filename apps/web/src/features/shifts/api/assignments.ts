import type * as v from "valibot"
import { keys } from "@/app/data/keys"
import {
  attendanceEnvelopeSchema,
  attendanceEventsResponseSchema,
  manageAttendanceInputSchema,
  myAssignmentsResponseSchema,
  shiftAttendanceResponseSchema,
  submitAttendanceInputSchema,
} from "@workspace/shared/shifts"
import { queryOptions, skipToken } from "@tanstack/react-query"

import { japanDateStart, japanMonthRange } from "@workspace/shared/japan-time"
import { apiJson, apiVoid } from "../../../lib/http/client"

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
    queryKey: keys.assignmentMonth(month, year),
    queryFn:
      year === null
        ? skipToken
        : ({ signal }) => getMyAssignments(year, range.from, range.to, signal),
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

/** Checks in, or says the member is late or absent, for their own shift. */
export const submitAttendance = (
  assignmentId: string,
  input: v.InferInput<typeof submitAttendanceInputSchema>
) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/attendance`,
    attendanceEnvelopeSchema,
    { method: "PUT", body: JSON.stringify(input) }
  )

/** Takes back being late or absent. */
export const withdrawAttendance = (assignmentId: string) =>
  apiVoid(`/api/assignments/${encodeURIComponent(assignmentId)}/attendance`, {
    method: "DELETE",
  })

/** A responsible corrects a check-in, or marks late or absent as handled. */
export const manageAttendance = (
  assignmentId: string,
  input: v.InferInput<typeof manageAttendanceInputSchema>
) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(assignmentId)}/attendance`,
    attendanceEnvelopeSchema,
    { method: "PATCH", body: JSON.stringify(input) }
  )

export const getShiftAttendance = (activityId: string) =>
  apiJson(
    `/api/activities/${encodeURIComponent(activityId)}/attendance`,
    shiftAttendanceResponseSchema
  )

export const getAttendanceEvents = (id: string) =>
  apiJson(
    `/api/assignments/${encodeURIComponent(id)}/attendance/events`,
    attendanceEventsResponseSchema
  )
