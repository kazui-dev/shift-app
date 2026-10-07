import { japanDateTime } from "@workspace/shared/japan-time"
import type { InferOutput } from "valibot"
import type { activitiesResponseSchema } from "@workspace/shared/shifts"
export type ActivityFilters = {
  dates: string[]
  responsibles: string[]
  places: string[]
}
export function filterActivities(
  activities: InferOutput<typeof activitiesResponseSchema>["activities"],
  filters: ActivityFilters,
  search: string,
  status: string
) {
  const term = search.trim().toLocaleLowerCase()
  return activities
    .filter(
      (item) =>
        (status === "all" || item.active === (status === "active")) &&
        (!filters.dates.length ||
          filters.dates.includes(japanDateTime(item.startsAt).date)) &&
        (!filters.responsibles.length ||
          item.responsibleNames.some((name) =>
            filters.responsibles.includes(name)
          )) &&
        (!filters.places.length || filters.places.includes(item.place)) &&
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
