import { createFileRoute } from "@tanstack/react-router"

import { SettingsPage } from "@/pages/settings-page"
import { preparePushControl } from "@/lib/push-control-store"

export const Route = createFileRoute("/_app/settings")({
  beforeLoad: ({ context }) =>
    preparePushControl(context.state.member.studentId),
  component: SettingsPage,
})
