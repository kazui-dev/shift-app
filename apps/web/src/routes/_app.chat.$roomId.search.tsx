import { createFileRoute } from "@tanstack/react-router"
import { ChatSearchPage } from "@/pages/chat-search-page"
export const Route = createFileRoute("/_app/chat/$roomId/search")({
  component: ChatSearchPage,
})
