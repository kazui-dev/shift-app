import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { resolveAccountState } from "@/lib/account-state"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const { state, offline } = await resolveAccountState(context.queryClient)
    if (state.status !== "active") {
      throw redirect({ to: "/" })
    }
    return { state, offline }
  },
  component: AuthenticatedLayout,
})
