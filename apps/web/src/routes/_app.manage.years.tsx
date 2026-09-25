import { createFileRoute, redirect } from "@tanstack/react-router"

import { ManagePage } from "@/features/management/pages/manage-page"

export const Route = createFileRoute("/_app/manage/years")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/manage" })
    }
  },
  component: () => <ManagePage view="years" />,
})
