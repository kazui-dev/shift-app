import { createFileRoute, redirect } from "@tanstack/react-router"

import { ManagePage } from "@/pages/manage-page"

export const Route = createFileRoute("/_app/manage/discord-link-requests")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/manage" })
    }
  },
  component: () => <ManagePage view="discordLinks" />,
})
