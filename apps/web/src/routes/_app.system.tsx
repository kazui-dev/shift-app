import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/system")({
  beforeLoad: ({ context }) => {
    if (
      context.offline ||
      context.state.member.accessLevel !== "system_admin"
    ) {
      throw redirect({ to: "/calendar" })
    }
    throw redirect({ to: "/manage" })
  },
})
