import { createFileRoute } from "@tanstack/react-router"

import { ManagePage } from "@/pages/manage-page"

export const Route = createFileRoute("/_app/manage/")({
  component: () => <ManagePage view="home" />,
})
