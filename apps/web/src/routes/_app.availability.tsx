import { createFileRoute, redirect } from "@tanstack/react-router"

import { AvailabilityPage } from "@/pages/availability-page"

export const Route = createFileRoute("/_app/availability")({
  beforeLoad: ({ context }) => {
    if (context.offline) throw redirect({ to: "/calendar" })
  },
  component: AvailabilityPage,
})
