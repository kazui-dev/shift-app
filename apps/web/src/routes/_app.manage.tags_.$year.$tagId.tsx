import { createFileRoute } from "@tanstack/react-router"
import { DetailTagPage } from "@/features/members/pages/tag-page"
export const Route = createFileRoute("/_app/manage/tags_/$year/$tagId")({
  component: DetailTagPage,
})
