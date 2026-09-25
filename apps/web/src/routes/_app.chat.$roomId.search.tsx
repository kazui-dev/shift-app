import { createFileRoute } from "@tanstack/react-router"
import { ChatSearchPage } from "@/features/chat/pages/chat-search-page"
export const Route = createFileRoute("/_app/chat/$roomId/search")({
  component: ChatSearchPage,
})
