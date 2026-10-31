import { getRouteApi } from "@tanstack/react-router"

import { AppShell } from "./app-shell"
import { ViewPreferencesProvider } from "./view-preferences-provider"

const routeApi = getRouteApi("/_app")

export function AuthenticatedLayout() {
  const { state, offline, checking } = routeApi.useRouteContext()
  return (
    <ViewPreferencesProvider key={state.member.id} user={state.member.id}>
      <AppShell accountOffline={offline} accountChecking={checking ?? false} />
    </ViewPreferencesProvider>
  )
}
