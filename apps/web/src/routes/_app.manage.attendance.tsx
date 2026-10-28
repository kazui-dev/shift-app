import { createFileRoute } from "@tanstack/react-router"
import { AttendanceSettingsPage } from "@/features/management/pages/screens"
export const Route = createFileRoute("/_app/manage/attendance")({
  component: AttendanceSettingsPage,
})
