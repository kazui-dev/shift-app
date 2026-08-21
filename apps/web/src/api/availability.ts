import {
  availabilityEnvelopeSchema,
  availabilitySubmissionsResponseSchema,
} from "@workspace/shared/shifts"

import { apiJson } from "./client"

export const getAvailability = (year: number) =>
  apiJson(`/api/me/availability/${year}`, availabilityEnvelopeSchema)

export const getAvailabilitySubmissions = (year: number) =>
  apiJson(
    `/api/years/${year}/availability-submissions`,
    availabilitySubmissionsResponseSchema
  )

export const replaceAvailability = (
  year: number,
  input: {
    status: "draft" | "submitted"
    windows: Array<{ startsAt: string; endsAt: string }>
  }
) =>
  apiJson(`/api/me/availability/${year}`, availabilityEnvelopeSchema, {
    method: "PUT",
    body: JSON.stringify(input),
  })
