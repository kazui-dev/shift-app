import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuditPage } from "@/features/management/pages/screens"

export const Route = createFileRoute("/_app/manage/audit")({
  beforeLoad: ({ context }) => {
    if (context.state.member.accessLevel !== "system_admin") {
      throw redirect({ to: "/manage" })
    }
  },
  component: AuditPage,
})
