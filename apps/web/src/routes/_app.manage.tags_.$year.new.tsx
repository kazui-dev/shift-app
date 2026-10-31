import { createFileRoute } from "@tanstack/react-router"
import { CreateTagPage } from "@/features/members/pages/tag-page"
export const Route = createFileRoute("/_app/manage/tags_/$year/new")({
  component: CreateTagPage,
})
