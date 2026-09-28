import { createFileRoute, Outlet } from "@tanstack/react-router"
import { chatImageLocation } from "@/features/chat/lib/image-location"
export const Route = createFileRoute("/_app/chat/$roomId")({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    image?: string | undefined
    message?: number | undefined
  } => ({
    ...chatImageLocation(search),
  }),
  component: Outlet,
})
