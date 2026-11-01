import type { FilterValue } from "@workspace/ui/lib/filters"
import * as v from "valibot"
import {
  filterPreferenceSchema,
  useViewPreference,
} from "@/lib/view-preferences"
import { createContext, useContext } from "react"
import type { useManagementYearState } from "@/features/management/use-management-year"

export type ManagementScreenView = {
  scrollTop: number
  search: string
  filters?: Record<string, FilterValue> | undefined
  sort?:
    | {
        column: "displayName" | "studentId" | "years" | "accessLevel"
        descending: boolean
      }
    | undefined
}

export type ManagementTableView = Pick<
  ManagementScreenView,
  "search" | "filters" | "sort"
> & {
  save: (patch: Partial<ManagementScreenView>) => void
}

const screenSchema = v.object({
  search: v.string(),
  filters: v.optional(v.record(v.string(), filterPreferenceSchema)),
  sort: v.optional(
    v.object({
      column: v.picklist(["displayName", "studentId", "years", "accessLevel"]),
      descending: v.boolean(),
    })
  ),
})
const initialScreen = { search: "" }

export const ManagementContext = createContext<{
  years: ReturnType<typeof useManagementYearState>
  dirty: boolean
  setDirty: (dirty: boolean) => void
  screenViews: Map<string, number>
} | null>(null)

export function useManagement() {
  const value = useContext(ManagementContext)
  if (!value) throw new Error("ManagementProvider is required")
  return value
}

export function useManagementScreenView(key: string) {
  const { screenViews } = useManagement()
  const [view, , update] = useViewPreference(
    `management:${key}`,
    screenSchema,
    initialScreen
  )
  return {
    ...view,
    scrollTop: screenViews.get(key) ?? 0,
    save(patch: Partial<ManagementScreenView>) {
      const { scrollTop, ...preferences } = patch
      if (scrollTop !== undefined) screenViews.set(key, scrollTop)
      if (Object.keys(preferences).length)
        update((current) => ({
          ...current,
          ...preferences,
          ...(preferences.filters
            ? { filters: { ...current.filters, ...preferences.filters } }
            : {}),
        }))
    },
  }
}
