import { createFileRoute } from "@tanstack/react-router"
import { ShiftListPage } from "@/features/shifts/pages/shift-list-page"

export const Route = createFileRoute("/_app/manage/shifts")({
  component: ShiftListPage,
})
