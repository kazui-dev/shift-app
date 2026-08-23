import {
  availabilityDateEnvelopeSchema,
  availabilityDatesResponseSchema,
  availabilityEnvelopeSchema,
  availabilitySubmissionsResponseSchema,
} from "@workspace/shared/shifts"

import { apiJson, apiVoid } from "./client"

export const getAvailability = (year: number) =>
  apiJson(`/api/me/availability/${year}`, availabilityEnvelopeSchema)

export const getAvailabilitySubmissions = (year: number) =>
  apiJson(
    `/api/years/${year}/availability-submissions`,
    availabilitySubmissionsResponseSchema
  )

export const getAvailabilityDates = (year: number) =>
  apiJson(
    `/api/years/${year}/availability-dates`,
    availabilityDatesResponseSchema
  )

export const createAvailabilityDate = (year: number, date: string) =>
  apiJson(
    `/api/years/${year}/availability-dates`,
    availabilityDateEnvelopeSchema,
    {
      method: "POST",
      body: JSON.stringify({ date }),
    }
  )

export const deleteAvailabilityDate = (year: number, date: string) =>
  apiVoid(`/api/years/${year}/availability-dates/${encodeURIComponent(date)}`, {
    method: "DELETE",
  })

export const replaceAvailability = (
  year: number,
  input: {
    status: "draft" | "submitted"
    windows: Array<{ date: string; startsAt: string; endsAt: string }>
  }
) =>
  apiJson(`/api/me/availability/${year}`, availabilityEnvelopeSchema, {
    method: "PUT",
    body: JSON.stringify(input),
  })
