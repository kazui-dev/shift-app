import {
  formResponseSchema,
  formDatesResponseSchema,
  type FormDate,
  type DayAnswer,
} from "@workspace/shared/availability"
import { availabilitySubmissionsResponseSchema } from "@workspace/shared/shifts"
import { apiJson, apiVoid } from "./client"
export const getAvailability = (year: number) =>
  apiJson(`/api/me/availability/${year}`, formResponseSchema)
export const replaceAvailability = (
  year: number,
  input: { answers: DayAnswer[]; submit: boolean }
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

export const notifyAvailability = (year: number, scope: "all" | "incomplete") =>
  apiVoid(`/api/years/${year}/availability-notifications`, {
    method: "POST",
    body: JSON.stringify({ scope }),
  })
