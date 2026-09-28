import { createFileRoute } from "@tanstack/react-router"
import { CreateShiftPage } from "@/features/shifts/pages/create-shift-page"

export const Route = createFileRoute("/_app/manage/shifts_/new")({
  component: CreateShiftPage,
})
