import { preparePushControl } from "@/lib/push/control-store"
import { keys } from "@/data/keys"
import { prepareApp } from "@/data/startup"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { resolveAccountState } from "@/lib/account/state"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const restoreReading =
      (location.pathname === "/calendar" ||
        location.pathname.startsWith("/chat")) &&
      context.queryClient.getQueryData(keys.displayYear()) !== undefined
    const { state, offline, checking } = await resolveAccountState(
      context.queryClient,
      restoreReading
    )
    if (state.status !== "active") {
      throw redirect({ to: "/" })
    }
    if (!offline && !checking) {
      void preparePushControl(state.member.studentId)
    }
    const dates = new URLSearchParams(location.searchStr).getAll("date")
    if (!offline && !checking)
      await prepareApp(
        context.queryClient,
        location.pathname,
        state.member.studentId,
        state.member.accessLevel === "system_admin",
        dates.length === 1 ? dates[0] : undefined
      )
    return { state, offline, checking }
  },
  component: AuthenticatedLayout,
})
