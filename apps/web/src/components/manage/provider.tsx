import { useMemo, useRef, type ReactNode } from "react"
import { useManagementYearState } from "@/components/use-management-year"
import { ManagementContext } from "./context"
import type { ContextType } from "react"

type State = NonNullable<ContextType<typeof ManagementContext>>
export function ManagementProvider({ children }: { children: ReactNode }) {
  const years = useManagementYearState()
  const shiftViews = useRef<State["shiftViews"]>(new Map())
  const value = useMemo(
    () => ({ years, shiftViews: shiftViews.current }),
    [years]
  )
  return <ManagementContext value={value}>{children}</ManagementContext>
}
