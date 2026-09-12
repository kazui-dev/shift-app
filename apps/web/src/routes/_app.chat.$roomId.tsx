import { createFileRoute, Outlet } from "@tanstack/react-router"
import { chatImageLocation } from "@/lib/chat-image-location"
export const Route = createFileRoute("/_app/chat/$roomId")({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    report?: string | undefined
    image?: string | undefined
    message?: number | undefined
  } => ({
    report: typeof search.report === "string" ? search.report : undefined,
    ...chatImageLocation(search),
  }),
  component: Outlet,
})
