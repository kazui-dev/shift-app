import { expect, it } from "vite-plus/test"
import {
  emptyFilter,
  filterLabel,
  filterDescription,
  selectFilterValues,
  pruneFilter,
  matchesFilter,
  type FilterValue,
} from "@workspace/ui/lib/filters"
const f = (
  values: string[],
  mode: keyof FilterValue = "include"
): FilterValue => ({
  include: mode === "include" ? values : [],
  exclude: mode === "exclude" ? values : [],
})
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
it("removes deleted options without changing exclusion or an explicitly empty filter", () => {
  const value = f(["a", "deleted"], "exclude")
  expect(pruneFilter(value, ["a"])).toEqual(f(["a"], "exclude"))
  expect(pruneFilter(value, ["a", "deleted"])).toBe(value)
  const cleared = emptyFilter()
  expect(pruneFilter(cleared, [])).toBe(cleared)
})

it("names the selected value, counts multiple values, and restores the original label on clearing", () => {
  const options = [
    { value: "a", label: "受付" },
    { value: "b", label: "案内" },
  ]
  expect(filterLabel("担当", options, f([]))).toBe("担当")
  expect(filterLabel("担当", options, f(["a"]))).toBe("受付")
  expect(filterLabel("担当", options, f(["a"], "exclude"))).toBe("受付を除外")
  expect(filterLabel("担当", options, f(["a"], "exclude"), false)).toBe("受付")
  expect(filterLabel("担当", options, f(["a", "b"]))).toBe("担当 (2)")
  expect(filterLabel("担当", options, f(["missing"]))).toBe("担当 (1)")
})

it("combines include and exclude, with exclusion winning even for multi-valued rows", () => {
  const both = { include: ["a", "b"], exclude: ["c"] }
  expect(matchesFilter(["a"], both)).toBe(true)
  expect(matchesFilter(["b"], both)).toBe(true)
  expect(matchesFilter(["a", "c"], both)).toBe(false)
  expect(matchesFilter(["d"], both)).toBe(false)
  expect(matchesFilter([], both)).toBe(false)
  expect(matchesFilter([], { include: [], exclude: ["unset"] })).toBe(false)
  expect(matchesFilter(["a"], { include: ["a"], exclude: ["a"] })).toBe(false)
  expect(selectFilterValues(both, "exclude", ["a", "c"])).toEqual({
    include: ["b"],
    exclude: ["a", "c"],
  })
  expect(selectFilterValues(both, "include", ["c"])).toEqual({
    include: ["c"],
    exclude: [],
  })
  expect(pruneFilter(both, ["a", "b"])).toEqual({
    include: ["a", "b"],
    exclude: [],
  })
  expect(pruneFilter(both, ["b", "c"])).toEqual({
    include: ["b"],
    exclude: ["c"],
  })
  const options = [
    { value: "a", label: "受付" },
    { value: "c", label: "広報" },
  ]
  expect(filterDescription(options, { include: ["a"], exclude: ["c"] })).toBe(
    "含む 受付 ／ 含まない 広報"
  )
  expect(
    filterDescription(options, { include: ["a"], exclude: [] }, false)
  ).toBe("受付")
  expect(filterDescription(options, { include: [], exclude: ["c"] })).toBe(
    "含まない 広報"
  )
  expect(
    filterDescription(options, { include: ["missing"], exclude: [] })
  ).toBe("含む missing")
  expect(filterDescription(options, emptyFilter())).toBe("すべて")
})
