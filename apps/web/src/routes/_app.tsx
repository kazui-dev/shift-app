import { prepareApp } from "@/data/startup"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { resolveAccountState } from "@/lib/account-state"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const { state, offline } = await resolveAccountState(context.queryClient)
    if (state.status !== "active") {
      throw redirect({ to: "/" })
    }
    if (!offline)
      await prepareApp(
        context.queryClient,
        location.pathname,
        state.member.studentId,
        state.member.accessLevel === "system_admin"
      )
    return { state, offline }
  },
  component: AuthenticatedLayout,
})
