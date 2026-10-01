import {
  formResponseSchema,
  formDatesResponseSchema,
  type FormDate,
  type DayAnswer,
} from "@workspace/shared/availability"
import {
  availabilityHistoryResponseSchema,
  availabilitySubmissionsResponseSchema,
} from "@workspace/shared/shifts"
import { apiJson, apiVoid } from "../../../lib/http/client"
export const getAvailability = (year: number) =>
  apiJson(`/api/me/availability/${year}`, formResponseSchema)
export const replaceAvailability = (
  year: number,
  input: { answers: DayAnswer[]; submit: boolean; revision: number }
) =>
  apiJson(`/api/me/availability/${year}`, formResponseSchema, {
    method: "PUT",
    body: JSON.stringify(input),
  })
export const getAvailabilityDates = (year: number) =>
  apiJson(`/api/years/${year}/availability-dates`, formDatesResponseSchema)
export const saveAvailabilityDate = (
  year: number,
  date: Omit<FormDate, "version">
) =>
  apiVoid(`/api/years/${year}/availability-dates/${date.date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(date),
  })
export const deleteAvailabilityDate = (year: number, date: string) =>
  apiVoid(`/api/years/${year}/availability-dates/${date}`, { method: "DELETE" })
export const getAvailabilitySubmissions = (year: number) =>
  apiJson(
    `/api/years/${year}/availability-submissions`,
    availabilitySubmissionsResponseSchema
  )

export const getAvailabilityHistory = (year: number, memberId: string) =>
  apiJson(
    `/api/years/${year}/availability-submissions/${encodeURIComponent(memberId)}/history`,
    availabilityHistoryResponseSchema
  )

export const notifyAvailability = (year: number, scope: "all" | "incomplete") =>
  apiVoid(`/api/years/${year}/availability-notifications`, {
    method: "POST",
    body: JSON.stringify({ scope }),
  })

export const getMemberAvailability = (year: number, memberId: string) =>
  apiJson(
    `/api/years/${year}/availability-submissions/${encodeURIComponent(memberId)}`,
    formResponseSchema
  )
export const saveMemberAvailability = (
  year: number,
  memberId: string,
  input: { answers: DayAnswer[]; revision: number }
) =>
  apiJson(
    `/api/years/${year}/availability-submissions/${encodeURIComponent(memberId)}`,
    formResponseSchema,
    { method: "PATCH", body: JSON.stringify(input) }
  )
