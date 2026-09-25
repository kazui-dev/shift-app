import { createContext, useContext } from "react"
import type { useManagementYearState } from "@/features/management/use-management-year"

export const ManagementContext = createContext<{
  years: ReturnType<typeof useManagementYearState>
} | null>(null)

export function useManagement() {
  const value = useContext(ManagementContext)
  if (!value) throw new Error("ManagementProvider is required")
  return value
}
