import { createContext, useContext } from "react"

export type MemberFilters = {
  search: string
  role: string
  includeUnavailable: boolean
}

export type ShiftView = { filters?: MemberFilters; scrollTop: number }
export const ShiftViewContext = createContext<Map<number, ShiftView> | null>(
  null
)

export function useShiftView(year: number) {
  const views = useContext(ShiftViewContext)
  if (!views) throw new Error("ShiftViewProvider is required")
  let view = views.get(year)
  if (!view) {
    view = { scrollTop: 0 }
    views.set(year, view)
  }
  return view
}
