import { expect, it } from "vite-plus/test"
import {
  matchesTableFilter,
  matchesTableSearch,
} from "@workspace/ui/lib/data-table"

it("retains OR, exclusion, unset and explicit empty column filters", () => {
  expect(matchesTableFilter(["a"], { include: ["a", "b"], exclude: [] })).toBe(
    true
  )
  expect(matchesTableFilter(["a"], { include: [], exclude: ["a"] })).toBe(false)
  expect(matchesTableFilter(["b"], { include: [], exclude: ["a"] })).toBe(true)
  expect(matchesTableFilter([], { include: ["unset"], exclude: [] })).toBe(true)
  expect(matchesTableFilter([""], { include: [""], exclude: [] })).toBe(true)
  expect(matchesTableFilter([], { include: [], exclude: [] })).toBe(true)
  for (const value of [
    null,
    "a",
    {},
    { include: "a", exclude: [] },
    { include: [] },
    { include: [], exclude: "invalid" },
    { include: [], exclude: [1] },
    { include: [1], exclude: [] },
  ])
    expect(matchesTableFilter(["a"], value)).toBe(false)
  expect(matchesTableSearch("受付 AB", " ab ")).toBe(true)
  expect(matchesTableSearch("受付 AB", "他")).toBe(false)
  expect(matchesTableSearch("受付 AB", null)).toBe(false)
})
