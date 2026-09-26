import { type ReactNode } from "react"
import { useManagementYearState } from "@/features/management/use-management-year"
import { ManagementContext } from "@/features/management/management-context"
import { ShiftViewProvider } from "@/features/shifts/shift-view-provider"

export function ManagementProvider({ children }: { children: ReactNode }) {
  const years = useManagementYearState()
  return (
    <ManagementContext value={{ years }}>
      <ShiftViewProvider>{children}</ShiftViewProvider>
    </ManagementContext>
  )
}
