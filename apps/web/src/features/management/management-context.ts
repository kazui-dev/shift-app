import { createContext, useContext } from "react"
import type { useManagementYearState } from "@/features/management/use-management-year"

export type ManagementScreenView = {
  scrollTop: number
  search: string
  filter: string
}

export const ManagementContext = createContext<{
  years: ReturnType<typeof useManagementYearState>
  dirty: boolean
  setDirty: (dirty: boolean) => void
  screenViews: Map<string, ManagementScreenView>
} | null>(null)

export function useManagement() {
  const value = useContext(ManagementContext)
  if (!value) throw new Error("ManagementProvider is required")
  return value
}

export function useManagementScreenView(key: string) {
  const { screenViews } = useManagement()
  let view = screenViews.get(key)
  if (!view) {
    view = { scrollTop: 0, search: "", filter: "" }
    screenViews.set(key, view)
  }
  return {
    ...view,
    save(patch: Partial<ManagementScreenView>) {
      screenViews.set(key, { ...(screenViews.get(key) ?? view), ...patch })
    },
  }
}
