import { createFileRoute } from "@tanstack/react-router"
import { TagsPage } from "@/features/management/pages/screens"

export const Route = createFileRoute("/_app/manage/tags")({
  component: TagsPage,
})
