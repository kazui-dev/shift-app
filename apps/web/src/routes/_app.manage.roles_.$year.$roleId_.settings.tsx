import { createFileRoute } from "@tanstack/react-router"
import { SettingsRolePage } from "@/features/roles/pages/role-page"
export const Route = createFileRoute(
  "/_app/manage/roles_/$year/$roleId_/settings"
)({ component: SettingsRolePage })
