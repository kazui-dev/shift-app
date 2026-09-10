import { createContext, useContext } from "react"

export type CalendarViewState = {
  date: string
  selectDate: (date: string) => void
  selectMonth: (months: number) => void
  readScrollTop: () => number | null
  saveScrollTop: (scrollTop: number) => void
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
