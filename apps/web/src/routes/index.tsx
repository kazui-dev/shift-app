import { createFileRoute, redirect } from "@tanstack/react-router"

import { resolveAccountState } from "@/features/account/lib/state"
import { AuthPage } from "@/features/account/pages/auth-page"

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const { state } = await resolveAccountState(context.queryClient)
    if (state.status === "active") {
      throw redirect({ to: "/calendar" })
    }
  },
  component: AuthPage,
})
