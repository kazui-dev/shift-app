import { createFileRoute } from "@tanstack/react-router"
import { CreateRolePage } from "@/features/roles/pages/role-page"

export const Route = createFileRoute("/_app/manage/roles_/$year/new")({
  component: CreateRolePage,
})
