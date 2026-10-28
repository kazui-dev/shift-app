import type { FilterValue } from "@workspace/ui/lib/filters"
import type { ActivityFilters } from "./activity-filters"
import { createContext, useContext } from "react"

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
  scrollTop: number
}
export const ShiftViewContext = createContext<Map<number, ShiftView> | null>(
  null
)

export function useShiftView(year: number) {
  const views = useContext(ShiftViewContext)
  if (!views) throw new Error("ShiftViewProvider is required")
  let view = views.get(year)
  if (!view) {
    view = {
      scrollTop: 0,
    }
    views.set(year, view)
  }
  return {
    ...view,
    save(patch: Partial<ShiftView>) {
      views.set(year, { ...(views.get(year) ?? view), ...patch })
    },
  }
}
