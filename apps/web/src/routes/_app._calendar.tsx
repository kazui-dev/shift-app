import { createFileRoute, Outlet } from "@tanstack/react-router"
import { CalendarScreen } from "@/components/calendar/calendar-screen"

export const Route = createFileRoute("/_app/_calendar")({
  component: () => (
    <>
      <CalendarScreen />
      <Outlet />
    </>
  ),
})
