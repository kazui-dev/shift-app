import * as v from "valibot"
import {
  memberTagChangesSchema,
  tagInputSchema,
  reorderTagInputSchema,
  yearTagsResponseSchema,
} from "@workspace/shared/shifts"
import { apiJson, apiVoid } from "@/lib/http/client"

export const getYearTags = (year: number) =>
  apiJson(`/api/years/${year}/tags`, yearTagsResponseSchema)
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

export function createTag(
  year: number,
  input: v.InferInput<typeof tagInputSchema>
) {
  return apiVoid(`/api/years/${year}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(v.parse(tagInputSchema, input)),
  })
}
export function updateTag(
  year: number,
  tagId: string,
  input: v.InferInput<typeof tagInputSchema>
) {
  return apiVoid(`/api/years/${year}/tags/${tagId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(v.parse(tagInputSchema, input)),
  })
}
export function deleteTag(year: number, tagId: string) {
  return apiVoid(`/api/years/${year}/tags/${tagId}`, { method: "DELETE" })
}
export function reorderTags(year: number, tagIds: string[]) {
  return apiVoid(`/api/years/${year}/tag-order`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(v.parse(reorderTagInputSchema, { tagIds })),
  })
}
