import { createFileRoute } from "@tanstack/react-router"

import { ManagePage } from "@/features/management/pages/manage-page"

export const Route = createFileRoute("/_app/manage/shifts_/availability")({
  component: () => <ManagePage view="availability" />,
})
