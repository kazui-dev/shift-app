import { getRouteApi, useSearch } from "@tanstack/react-router"
import { CalendarPage } from "@/features/calendar/pages/calendar-page"
import { CalendarViewStateProvider } from "@/features/calendar/components/calendar-view-state"
import { useDisplayYear } from "@/app/use-display-year"
import { calendarViewKey } from "@/features/calendar/lib/view"
export function CalendarScreen() {
  const { state } = getRouteApi("/_app").useRouteContext()
  const { date } = useSearch({ strict: false })
  const { year } = useDisplayYear()
  const key = calendarViewKey(state.member.studentId, year)
  return (
    <CalendarViewStateProvider key={key} storageKey={key} explicitDate={date}>
      <CalendarPage />
    </CalendarViewStateProvider>
  )
}
