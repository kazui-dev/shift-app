import { useState, type ReactNode } from "react"
import { useManagementYearState } from "@/features/management/use-management-year"
import { ManagementContext } from "@/features/management/management-context"
import { ShiftViewProvider } from "@/features/shifts/shift-view-provider"

export function ManagementProvider({ children }: { children: ReactNode }) {
  const years = useManagementYearState()
  const [dirty, setDirty] = useState(false)
  const [screenViews] = useState(() => new Map<string, number>())
  return (
    <ManagementContext value={{ years, dirty, setDirty, screenViews }}>
      <ShiftViewProvider>{children}</ShiftViewProvider>
    </ManagementContext>
  )
}
