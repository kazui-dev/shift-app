import { createFileRoute } from "@tanstack/react-router"
import { RoomSettingsPage } from "@/pages/room-settings-page"

export const Route = createFileRoute("/_app/chat/$roomId/info/settings")({
  component: RoomSettingsPage,
})
