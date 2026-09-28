import { createFileRoute } from "@tanstack/react-router"

import { preparePushControl } from "@/features/notifications/lib/control-store"
import { SettingsPage } from "@/features/settings/pages/settings-page"

export const Route = createFileRoute("/_app/settings")({
  // The page shows the notification toggle already settled, so it waits for
  // the device's own state even when the app opened from its kept account.
  loader: async ({ context }) => {
    if (!context.offline && context.state.status === "active")
      await preparePushControl(context.state.member.studentId)
  },
  component: SettingsPage,
})
