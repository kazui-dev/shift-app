import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"

import { NotFoundPage } from "@/app/not-found-page.tsx"
import { RouteErrorPage } from "@/app/route-error-page.tsx"

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  errorComponent: RouteErrorPage,
  notFoundComponent: NotFoundPage,
})
