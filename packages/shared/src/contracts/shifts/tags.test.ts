import * as v from "valibot"
import { expect, it } from "vite-plus/test"
import {
  memberTagChangesSchema,
  tagInputSchema,
  yearTagsResponseSchema,
} from "./tags"

it("normalizes tag names and rejects blank or overly long names", () => {
  expect(v.parse(tagInputSchema, { name: "  確認済み  " })).toEqual({
    name: "確認済み",
  })
  for (const name of ["", "   ", "a".repeat(101), null])
    expect(v.safeParse(tagInputSchema, { name }).success).toBe(false)
})
it("rejects contradictory additions and removals", () => {
  const member = "10000000-0000-4000-8000-000000000001"
  const tag = "20000000-0000-4000-8000-000000000001"
  expect(
    v.safeParse(memberTagChangesSchema, {
      memberIds: [member],
      addTagIds: [tag],
      removeTagIds: [],
    }).success
  ).toBe(true)
  expect(
    v.safeParse(memberTagChangesSchema, {
      memberIds: [member],
      addTagIds: [],
      removeTagIds: [tag],
    }).success
  ).toBe(true)
  expect(
    v.safeParse(memberTagChangesSchema, {
      memberIds: [member],
      addTagIds: [tag],
      removeTagIds: [tag],
    }).success
  ).toBe(false)
  expect(
    v.safeParse(yearTagsResponseSchema, {
      tags: [{ id: tag, name: "任意のタグ", memberIds: [member] }],
    }).success
  ).toBe(true)
})
