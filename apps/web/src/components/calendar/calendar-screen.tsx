import { getRouteApi } from "@tanstack/react-router"
import { CalendarPage } from "@/pages/calendar-page"
import { CalendarViewStateProvider } from "@/components/calendar-view-state"
import { useDisplayYear } from "@/components/use-display-year"
import { calendarViewKey } from "@/lib/calendar-view"
export function CalendarScreen() {
  const { state } = getRouteApi("/_app").useRouteContext()
  const { date } = getRouteApi("/_app/calendar").useSearch()
  const { year } = useDisplayYear()
  const key = calendarViewKey(state.member.studentId, year)
  return (
    <CalendarViewStateProvider key={key} storageKey={key} explicitDate={date}>
      <CalendarPage />
    </CalendarViewStateProvider>
  )
}
