import { createFileRoute } from "@tanstack/react-router"
import { RoleDetailPage } from "@/features/roles/pages/role-page"

export const Route = createFileRoute("/_app/manage/roles_/$year/$roleId")({
  component: RoleDetailPage,
})
