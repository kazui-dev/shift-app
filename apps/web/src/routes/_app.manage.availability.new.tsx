import { createFileRoute } from "@tanstack/react-router"
import { AvailabilityDatePage } from "@/pages/availability-date-page"
export const Route = createFileRoute("/_app/manage/availability/new")({
  component: () => <AvailabilityDatePage />,
})
