import type { FilterValue } from "@workspace/ui/lib/filters"
import type { ActivityFilters } from "./activity-filters"
import { createContext, useContext } from "react"
import * as v from "valibot"
import {
  filterPreferenceSchema,
  useViewPreference,
} from "@/lib/view-preferences"

export type MemberFilters = {
  search: string
  roles: FilterValue
  availability: FilterValue
}

export type ShiftView = {
  mode?: "list" | "overview"
  overview?: import("./components/overview-model").OverviewFilters
  filters?: MemberFilters
  listFilters?: ActivityFilters
  listSearch?: string
  listStatus?: FilterValue
  scrollTop: number
}
const viewSchema = v.object({
  mode: v.optional(v.picklist(["list", "overview"])),
  overview: v.optional(
    v.object({
      date: v.pipe(v.string(), v.isoDate()),
      search: v.string(),
      roles: filterPreferenceSchema,
      activities: filterPreferenceSchema,
    })
  ),
  filters: v.optional(
    v.object({
      search: v.string(),
      roles: filterPreferenceSchema,
      availability: filterPreferenceSchema,
    })
  ),
  listFilters: v.optional(
    v.object({
      dates: filterPreferenceSchema,
      responsibles: filterPreferenceSchema,
      places: filterPreferenceSchema,
    })
  ),
  listSearch: v.optional(v.string()),
  listStatus: v.optional(filterPreferenceSchema),
})
const initialView = {}
export const ShiftViewContext = createContext<Map<string, number> | null>(null)

export function useShiftView(year: number, activityId?: string) {
  const views = useContext(ShiftViewContext)
  if (!views) throw new Error("ShiftViewProvider is required")
  const key = activityId ? `shift:${year}:${activityId}` : `shifts:${year}`
  const [view, , update] = useViewPreference(key, viewSchema, initialView)
  return {
    ...view,
    scrollTop: views.get(key) ?? 0,
    save(patch: Partial<ShiftView>) {
      const { scrollTop, ...preferences } = patch
      if (scrollTop !== undefined) views.set(key, scrollTop)
      if (Object.keys(preferences).length)
        update((current) => ({ ...current, ...preferences }))
    },
  }
}
