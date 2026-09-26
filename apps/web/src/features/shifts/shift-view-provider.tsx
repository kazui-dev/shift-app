import { useRef, type ReactNode } from "react"
import { ShiftViewContext, type ShiftView } from "./shift-view-context"

export function ShiftViewProvider({ children }: { children: ReactNode }) {
  const views = useRef(new Map<number, ShiftView>())
  return <ShiftViewContext value={views.current}>{children}</ShiftViewContext>
}
