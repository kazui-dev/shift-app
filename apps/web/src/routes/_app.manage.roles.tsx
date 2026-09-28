import { createFileRoute } from "@tanstack/react-router"

import { RolesPage } from "@/features/management/pages/screens"

export const Route = createFileRoute("/_app/manage/roles")({
  component: RolesPage,
})
