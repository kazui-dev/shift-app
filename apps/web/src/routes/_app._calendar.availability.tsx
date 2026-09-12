import { createFileRoute, redirect } from "@tanstack/react-router"

import { AvailabilityPage } from "@/pages/availability-page"

export const Route = createFileRoute("/_app/_calendar/availability")({
  beforeLoad: ({ context }) => {
    if (context.offline) throw redirect({ to: "/calendar" })
  },
  component: AvailabilityPage,
})
