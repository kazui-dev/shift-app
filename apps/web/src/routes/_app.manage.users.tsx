import { createFileRoute, redirect } from "@tanstack/react-router"

import { UsersPage } from "@/features/management/pages/screens"

export const Route = createFileRoute("/_app/manage/users")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/manage" })
    }
  },
  component: UsersPage,
})
