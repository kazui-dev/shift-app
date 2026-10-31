import { createFileRoute } from "@tanstack/react-router"
import { SettingsTagPage } from "@/features/members/pages/tag-page"
export const Route = createFileRoute(
  "/_app/manage/tags_/$year/$tagId_/settings"
)({ component: SettingsTagPage })
