import { createFileRoute, redirect } from "@tanstack/react-router"

import { AuthenticatedLayout } from "@/components/authenticated-layout"
import { authStateQueryOptions } from "@/lib/auth-state"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const state = await context.queryClient.ensureQueryData(
      authStateQueryOptions
    )
    if (state.status !== "active") {
      throw redirect({ to: "/" })
    }
    return { state }
  },
  component: AuthenticatedLayout,
})
