import { createFileRoute, redirect } from "@tanstack/react-router"

import { ManagePage } from "@/pages/manage-page"

export const Route = createFileRoute("/_app/manage/members")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/manage" })
    }
  },
  component: () => <ManagePage view="members" />,
})
