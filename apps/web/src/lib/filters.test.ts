import { expect, it } from "vite-plus/test"
import {
  emptyFilter,
  matchesFilter,
  type FilterValue,
} from "@workspace/ui/lib/filters"
const f = (
  values: string[],
  mode: FilterValue["mode"] = "include"
): FilterValue => ({ values, mode })
it("uses OR within a filter, supports exclusion, and distinguishes unassigned from a missing specific tag", () => {
  expect(matchesFilter(["a"], emptyFilter())).toBe(true)
  expect(matchesFilter(["b"], f(["a", "b"]))).toBe(true)
  expect(matchesFilter(["c"], f(["a", "b"]))).toBe(false)
  expect(matchesFilter(["a", "c"], f(["a", "b"], "exclude"))).toBe(false)
  expect(matchesFilter(["c"], f(["a", "b"], "exclude"))).toBe(true)
  expect(matchesFilter([], f(["unset"]))).toBe(true)
  expect(matchesFilter(["a"], f(["unset"]))).toBe(false)
  expect(matchesFilter([], f(["a"], "exclude"))).toBe(true)
  expect(matchesFilter(["b"], f(["a"], "exclude"))).toBe(true)
  expect(matchesFilter([], f(["unset"], "exclude"))).toBe(false)
  expect(matchesFilter(["a"], f(["unset"], "exclude"))).toBe(true)
  expect(matchesFilter([], f([], "exclude"))).toBe(true)
  expect(matchesFilter([], f(["unset", "a"]))).toBe(true)
})
