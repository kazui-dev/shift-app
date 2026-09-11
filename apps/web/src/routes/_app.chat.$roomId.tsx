import { createFileRoute } from "@tanstack/react-router"
import { ChatRoomPage } from "@/pages/chat-room-page"
export const Route = createFileRoute("/_app/chat/$roomId")({
  validateSearch: (
    search: Record<string, unknown>
  ): { report?: string | undefined } => ({
    report: typeof search.report === "string" ? search.report : undefined,
  }),
  component: ChatRoomPage,
})
