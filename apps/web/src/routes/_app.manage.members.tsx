import { createFileRoute } from "@tanstack/react-router"

import { ManagePage } from "@/features/management/pages/manage-page"

export const Route = createFileRoute("/_app/manage/members")({
  component: () => <ManagePage view="members" />,
})
