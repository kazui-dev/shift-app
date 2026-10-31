import { useState, type ReactNode } from "react"
import { ShiftViewContext } from "./shift-view-context"

export function ShiftViewProvider({ children }: { children: ReactNode }) {
  const [views] = useState(() => new Map<string, number>())
  return <ShiftViewContext value={views}>{children}</ShiftViewContext>
}
