import { createFileRoute, redirect } from "@tanstack/react-router"

import { YearsPage } from "@/features/management/pages/screens"

export const Route = createFileRoute("/_app/manage/years")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/manage" })
    }
  },
  component: YearsPage,
})
