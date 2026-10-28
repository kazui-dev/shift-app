import * as v from "valibot"
import {
  memberTagChangesSchema,
  tagInputSchema,
  yearTagsResponseSchema,
} from "@workspace/shared/shifts"
import { apiJson, apiVoid } from "@/lib/http/client"

export const getYearTags = (year: number) =>
  apiJson(`/api/years/${year}/tags`, yearTagsResponseSchema)
export function saveTag(year: number, name: string, id?: string) {
  const input = v.parse(tagInputSchema, { name })
  return apiVoid(
    `/api/years/${year}/tags${id ? `/${encodeURIComponent(id)}` : ""}`,
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  )
}
export const deleteTag = (year: number, id: string) =>
  apiVoid(`/api/years/${year}/tags/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
export function changeMemberTags(
  year: number,
  input: v.InferInput<typeof memberTagChangesSchema>
) {
  return apiVoid(`/api/years/${year}/member-tags`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(v.parse(memberTagChangesSchema, input)),
  })
}
