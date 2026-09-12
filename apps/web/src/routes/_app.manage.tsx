import { createFileRoute, redirect } from "@tanstack/react-router"

import { ManagementLayout } from "@/components/manage/layout"

export const Route = createFileRoute("/_app/manage")({
  beforeLoad: ({ context }) => {
    if (context.offline) throw redirect({ to: "/calendar" })
  },
  component: ManagementLayout,
})
