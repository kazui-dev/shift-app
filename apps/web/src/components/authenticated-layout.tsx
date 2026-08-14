import { getRouteApi } from "@tanstack/react-router"

import { AppShell } from "./app-shell"

const routeApi = getRouteApi("/_app")

export function AuthenticatedLayout() {
  const { state } = routeApi.useRouteContext()
  return <AppShell state={state} />
}
