import {
  activitiesResponseSchema,
  activityDetailResponseSchema,
  activityEnvelopeSchema,
} from "@workspace/shared/shifts"

import { apiJson } from "./client"

export const getActivities = (year: number) =>
  apiJson(`/api/years/${year}/activities`, activitiesResponseSchema)

export const getActivity = (activityId: string) =>
  apiJson(
    `/api/activities/${encodeURIComponent(activityId)}`,
    activityDetailResponseSchema
  )

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
