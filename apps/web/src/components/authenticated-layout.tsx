import { getRouteApi } from "@tanstack/react-router"

import { AppShell } from "./app-shell"

const routeApi = getRouteApi("/_app")

export function AuthenticatedLayout() {
  const { offline, checking } = routeApi.useRouteContext()
  return (
    <AppShell accountOffline={offline} accountChecking={checking ?? false} />
  )
}
