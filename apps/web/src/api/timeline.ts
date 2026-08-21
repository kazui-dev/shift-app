import { timelineResponseSchema } from "@workspace/shared/shifts"

import { apiJson } from "./client"

export const getTimeline = (from: string, to: string) => {
  const query = new URLSearchParams({ from, to })
  return apiJson(`/api/me/timeline?${query}`, timelineResponseSchema)
}
