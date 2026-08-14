import { createFileRoute } from "@tanstack/react-router"

import { AvailabilityPage } from "@/pages/availability-page"

export const Route = createFileRoute("/_app/availability")({
  component: AvailabilityPage,
})
