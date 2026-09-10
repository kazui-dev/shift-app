import { createFileRoute } from "@tanstack/react-router"

import { SettingsPage } from "@/pages/settings-page"
import { initializePushControl } from "@/lib/push-control-store"

export const Route = createFileRoute("/_app/settings")({
  beforeLoad: () => initializePushControl(),
  component: SettingsPage,
})
