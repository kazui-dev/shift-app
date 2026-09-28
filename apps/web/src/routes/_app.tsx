import { preparePushControl } from "@/features/notifications/lib/control-store"
import { prepareApp } from "@/app/data/startup"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthenticatedLayout } from "@/app/authenticated-layout"
import { resolveAccountState } from "@/features/account/lib/state"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const { state, offline, checking } = await resolveAccountState(
      context.queryClient
    )
    if (state.status !== "active") {
      throw redirect({ to: "/" })
    }
    // A page shown from the kept account prepares once the app has verified it.
    if (!offline && !checking) {
      void preparePushControl(state.member.studentId)
      const dates = new URLSearchParams(location.searchStr).getAll("date")
      await prepareApp(
        context.queryClient,
        location.pathname,
        state.member.studentId,
        state.member.accessLevel === "system_admin",
        dates.length === 1 ? dates[0] : undefined
      )
    }
    return { state, offline, checking }
  },
  component: AuthenticatedLayout,
})
