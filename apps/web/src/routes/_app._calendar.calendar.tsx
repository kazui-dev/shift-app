import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { calendarDate } from "@/lib/calendar-view"

export const Route = createFileRoute("/_app/_calendar/calendar")({
  validateSearch: (
    search: Record<string, unknown>
  ): { date?: string | undefined } => ({
    ...search,
    date: calendarDate(search.date),
  }),
  beforeLoad: ({ location }) => {
    const raw = new URLSearchParams(location.searchStr).getAll("date")
    if (raw.length && (raw.length !== 1 || !calendarDate(raw[0])))
      throw redirect({
        to: "/calendar",
        search: (previous) => ({ ...previous, date: undefined }),
        replace: true,
      })
  },
  component: Outlet,
})
