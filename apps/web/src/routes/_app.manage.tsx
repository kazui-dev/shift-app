import { createFileRoute, redirect } from "@tanstack/react-router"

import { ManagePage } from "@/pages/manage-page"

export const Route = createFileRoute("/_app/manage")({
  beforeLoad: ({ context }) => {
    if (context.offline) throw redirect({ to: "/timeline" })
  },
  component: ManagePage,
})
