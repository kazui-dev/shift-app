import { emptyFilter, type FilterValue } from "@workspace/ui/lib/filters"
import { expect, it } from "vite-plus/test"
import { filterActivities, type ActivityFilters } from "./activity-filters"
import { makeEditors } from "../../../dev/fixtures"
const activities = makeEditors().map((data, index) => ({
  ...data.activity,
  active: index % 2 === 0,
  assignmentCount: 0,
  requirements: data.requirements,
  responsibleNames: [index % 2 ? "広報局" : "総務局"],
}))
const f = (values: string[]): FilterValue => ({ values, mode: "include" })
const all: ActivityFilters = {
  dates: f([]),
  responsibles: f([]),
  places: f([]),
}
it("combines dimensions with AND and multiple dates with OR, preserving chronological order", () => {
  expect(filterActivities(activities, all, "", emptyFilter())).toHaveLength(9)
  expect(
    filterActivities(
      activities,
      { ...all, dates: f(["2026-11-01", "2026-11-03"]) },
      "",
      emptyFilter()
    )
  ).toHaveLength(6)
  const filters: ActivityFilters = {
    dates: f(["2026-11-01"]),
    responsibles: f(["総務局"]),
    places: f(["1号館 正面入口"]),
  }
  expect(
    filterActivities(activities, filters, "総合受付", f(["active"]))
  ).toHaveLength(1)
  expect(
    filterActivities(activities, filters, "", f(["inactive"]))
  ).toHaveLength(0)
  expect(
    filterActivities(activities, all, "不存在", emptyFilter())
  ).toHaveLength(0)
  expect(
    filterActivities(activities, { ...all, places: f([""]) }, "", emptyFilter())
  ).toHaveLength(0)
})
