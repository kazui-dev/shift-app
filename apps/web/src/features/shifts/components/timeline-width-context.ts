import { createContext, useContext } from "react"

export type TimelineWidthAnchor = { offsetHours: number; viewportX: number }

export const TimelineWidthContext = createContext<{
  width: number
  preview: (width: number, anchor?: TimelineWidthAnchor) => void
  commit: (width: number) => void
} | null>(null)

export function useTimelineWidth() {
  return useContext(TimelineWidthContext)
}
