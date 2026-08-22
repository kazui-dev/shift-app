import { createContext, useContext, type RefObject } from "react"

export type CalendarViewState = {
  date: string
  setDate: (date: string) => void
  preferredDayRef: RefObject<number>
  scrollTopRef: RefObject<number | null>
}

export const CalendarViewStateContext = createContext<CalendarViewState | null>(
  null
)

export function useCalendarViewState(): CalendarViewState {
  const state = useContext(CalendarViewStateContext)
  if (!state) {
    throw new Error("CalendarViewStateProvider is missing")
  }
  return state
}
