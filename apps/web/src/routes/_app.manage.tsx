import { createFileRoute, redirect } from "@tanstack/react-router"

import { ManagementLayout } from "@/features/management/components/layout"
import { yearsQuery } from "@/features/years/data/years"
import { canOpenManagement } from "@/features/account/lib/management"

export const Route = createFileRoute("/_app/manage")({
  beforeLoad: async ({ context }) => {
    if (context.offline) throw redirect({ to: "/calendar" })
    const { years } = await context.queryClient.ensureQueryData(yearsQuery)
    if (!canOpenManagement(context.state.member.accessLevel, years))
      throw redirect({ to: "/calendar", replace: true })
  },
  component: ManagementLayout,
})
