import { createFileRoute } from "@tanstack/react-router"

import { ManagementAvailabilityPage } from "@/features/management/pages/screens"

export const Route = createFileRoute("/_app/manage/shifts_/availability")({
  component: ManagementAvailabilityPage,
})
