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
const all: ActivityFilters = { dates: [], responsibles: [], places: [] }
it("combines dimensions with AND and multiple dates with OR, preserving chronological order", () => {
  expect(filterActivities(activities, all, "", "all")).toHaveLength(9)
  expect(
    filterActivities(
      activities,
      { ...all, dates: ["2026-11-01", "2026-11-03"] },
      "",
      "all"
    )
  ).toHaveLength(6)
  const filters = {
    dates: ["2026-11-01"],
    responsibles: ["総務局"],
    places: ["1号館 正面入口"],
  }
  expect(
    filterActivities(activities, filters, "総合受付", "active")
  ).toHaveLength(1)
  expect(filterActivities(activities, filters, "", "inactive")).toHaveLength(0)
  expect(filterActivities(activities, all, "不存在", "all")).toHaveLength(0)
  expect(
    filterActivities(activities, { ...all, places: [""] }, "", "all")
  ).toHaveLength(0)
})
