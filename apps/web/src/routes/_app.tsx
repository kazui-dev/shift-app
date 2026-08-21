import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { accountStateQueryOptions } from "@/lib/account-state"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const state = await context.queryClient.ensureQueryData(
      accountStateQueryOptions
    )
    if (state.status !== "active") {
      throw redirect({ to: "/" })
    }
    return { state }
  },
  component: AuthenticatedLayout,
})
