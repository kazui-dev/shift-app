import {
  announcementEnvelopeSchema,
  announcementsResponseSchema,
} from "@workspace/shared/communications"

import { apiJson, apiVoid } from "./client"

export const getAnnouncements = (year: number) => {
  return apiJson(
    `/api/years/${year}/announcements`,
    announcementsResponseSchema
  )
}

export const createAnnouncement = (
  year: number,
  input: {
    title: string
    body: string
    priority: "normal" | "important"
    expiresAt: string | null
  }
) =>
  apiJson(`/api/years/${year}/announcements`, announcementEnvelopeSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export const archiveAnnouncement = (announcementId: string) =>
  apiVoid(`/api/announcements/${encodeURIComponent(announcementId)}`, {
    method: "DELETE",
  })
