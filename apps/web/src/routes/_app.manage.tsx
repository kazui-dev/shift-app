import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/manage")({
  beforeLoad: ({ context }) => {
    if (context.offline) throw redirect({ to: "/calendar" })
  },
  component: Outlet,
})
