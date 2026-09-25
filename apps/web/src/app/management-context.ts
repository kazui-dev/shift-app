import { createContext, useContext } from "react"
import type { useManagementYearState } from "@/app/use-management-year"

export type MemberFilters = {
  search: string
  role: string
  includeUnavailable: boolean
}
type ShiftView = { filters?: MemberFilters; scrollTop: number }
export const ManagementContext = createContext<{
  years: ReturnType<typeof useManagementYearState>
  shiftViews: Map<number, ShiftView>
} | null>(null)

export function useManagement() {
  const value = useContext(ManagementContext)
  if (!value) throw new Error("ManagementProvider is required")
  return value
}

export function useShiftView(year: number) {
  const { shiftViews } = useManagement()
  let view = shiftViews.get(year)
  if (!view) {
    view = { scrollTop: 0 }
    shiftViews.set(year, view)
  }
  return view
}
