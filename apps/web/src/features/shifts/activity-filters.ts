import { matchesFilter, type FilterValue } from "@workspace/ui/lib/filters"
import { japanDateTime } from "@workspace/shared/japan-time"
import type { InferOutput } from "valibot"
import type { activitiesResponseSchema } from "@workspace/shared/shifts"
export type ActivityFilters = {
  dates: FilterValue
  responsibles: FilterValue
  places: FilterValue
}
export function filterActivities(
  activities: InferOutput<typeof activitiesResponseSchema>["activities"],
  filters: ActivityFilters,
  search: string,
  status: FilterValue
) {
  const term = search.trim().toLocaleLowerCase()
  return activities
    .filter(
      (item) =>
        matchesFilter([item.active ? "active" : "inactive"], status) &&
        matchesFilter([japanDateTime(item.startsAt).date], filters.dates) &&
        matchesFilter(item.responsibleNames, filters.responsibles) &&
        matchesFilter([item.place], filters.places) &&
        `${item.name} ${item.responsibleNames.join(" ")} ${item.place}`
          .toLocaleLowerCase()
          .includes(term)
    )
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) ||
        a.name.localeCompare(b.name, "ja")
    )
}
