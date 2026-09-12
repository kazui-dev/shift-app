import { createFileRoute } from "@tanstack/react-router"
import { EditAvailabilityDatePage } from "@/pages/availability-date-page"
export const Route = createFileRoute("/_app/manage/shifts/availability/$date")({
  component: EditAvailabilityDatePage,
})
