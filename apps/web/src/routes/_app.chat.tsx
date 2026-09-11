import { createFileRoute } from "@tanstack/react-router"

import { ChatPage } from "@/pages/chat-page"

export const Route = createFileRoute("/_app/chat")({
  validateSearch: (
    search: Record<string, unknown>
  ): { room?: string | undefined; report?: string | undefined } => ({
    room: typeof search.room === "string" ? search.room : undefined,
    report: typeof search.report === "string" ? search.report : undefined,
  }),
  component: ChatPage,
})
