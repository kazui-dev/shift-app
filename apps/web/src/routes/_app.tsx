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
    const dates = new URLSearchParams(location.searchStr).getAll("date")
    if (!offline)
      await prepareApp(
        context.queryClient,
        location.pathname,
        state.member.studentId,
        state.member.accessLevel === "system_admin",
        dates.length === 1 ? dates[0] : undefined
      )
    return { state, offline }
  },
  component: AuthenticatedLayout,
})
