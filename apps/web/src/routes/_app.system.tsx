import { createFileRoute, redirect } from "@tanstack/react-router"

import { SystemPage } from "@/pages/system-page"

export const Route = createFileRoute("/_app/system")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/timeline" })
    }
  },
  component: SystemPage,
})
