import {
  announcementEnvelopeSchema,
  announcementsResponseSchema,
} from "@workspace/shared/communications"

import { apiJson, apiVoid } from "./api"

export const getAnnouncements = (year: number) => {
  const query = new URLSearchParams({ year: String(year) })
  return apiJson(`/api/announcements?${query}`, announcementsResponseSchema)
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
