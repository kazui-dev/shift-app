import {
  activitiesResponseSchema,
  activityEditorResponseSchema,
  type ActivityEditorInput,
  activityEnvelopeSchema,
} from "@workspace/shared/shifts"

import * as v from "valibot"
import { apiJson, apiVoid } from "./client"

export const getActivities = (year: number) =>
  apiJson(`/api/years/${year}/activities`, activitiesResponseSchema)

export const getActivity = (activityId: string) =>
  apiJson(
    `/api/activities/${encodeURIComponent(activityId)}`,
    activityEditorResponseSchema
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
    responsibles: ActivityEditorInput["responsibles"]
    candidateRoleIds: string[]
  }
) =>
  apiJson(`/api/years/${year}/activities`, activityEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const saveActivity = (id: string, input: ActivityEditorInput) =>
  apiJson(
    `/api/activities/${encodeURIComponent(id)}`,
    activityEditorResponseSchema,
    { method: "PUT", body: JSON.stringify(input) }
  )

export const copyActivity = (id: string, date: string) =>
  apiJson(
    `/api/activities/${encodeURIComponent(id)}/copies`,
    v.object({ id: v.pipe(v.string(), v.uuid()) }),
    { method: "POST", body: JSON.stringify({ date }) }
  )
export const deleteActivity = (id: string) =>
  apiVoid(`/api/activities/${encodeURIComponent(id)}`, { method: "DELETE" })
export const notifyActivity = (id: string) =>
  apiVoid(`/api/activities/${encodeURIComponent(id)}/notifications`, {
    method: "POST",
  })
