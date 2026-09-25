import { createFileRoute, redirect } from "@tanstack/react-router"

import { ManagePage } from "@/features/management/pages/manage-page"

export const Route = createFileRoute("/_app/manage/users")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/manage" })
    }
  },
  component: () => <ManagePage view="users" />,
})
