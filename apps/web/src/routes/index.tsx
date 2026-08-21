import { createFileRoute, redirect } from "@tanstack/react-router"

import { accountStateQueryOptions } from "@/lib/account-state"
import { AuthPage } from "@/pages/auth-page"

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const state = await context.queryClient.ensureQueryData(
      accountStateQueryOptions
    )
    if (state.status === "active") {
      throw redirect({ to: "/timeline" })
    }
  },
  component: AuthPage,
})
