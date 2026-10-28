import * as v from "valibot"

const id = v.pipe(v.string(), v.uuid())
export const tagInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
})
export const memberTagChangesSchema = v.pipe(
  v.object({
    memberIds: v.pipe(v.array(id), v.minLength(1), v.maxLength(1000)),
    addTagIds: v.pipe(v.array(id), v.maxLength(100)),
    removeTagIds: v.pipe(v.array(id), v.maxLength(100)),
  }),
  v.check(
    (input) => !input.addTagIds.some((tag) => input.removeTagIds.includes(tag))
  )
)
export const yearTagsResponseSchema = v.object({
  tags: v.array(v.object({ id, name: v.string(), memberIds: v.array(id) })),
})
export type YearTag = v.InferOutput<
  typeof yearTagsResponseSchema
>["tags"][number]
