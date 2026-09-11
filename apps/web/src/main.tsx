import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { defaultShouldDehydrateQuery } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createRouter, RouterProvider } from "@tanstack/react-router"

import "@workspace/ui/globals.css"
import "./app-layout.css"
import { AppToaster } from "@/components/app-toaster.tsx"
import { PwaUpdateNotice } from "@/components/pwa-update-notice.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import {
  persister,
  queryClient,
  shouldPersistQueryKey,
} from "@/lib/query-client.ts"
import { initializePushControl } from "@/lib/push-control-store.ts"
import { routeTree } from "./routeTree.gen.ts"

const router = createRouter({
  routeTree,
  context: { queryClient },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Application root element was not found")
}

void initializePushControl()

createRoot(rootElement).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: "shift-app-cache-2026-09-chat-profiles-v4",
        dehydrateOptions: {
          shouldDehydrateMutation: () => false,
          shouldDehydrateQuery: (query) =>
            query.meta?.persist !== false &&
            shouldPersistQueryKey(query.queryKey) &&
            defaultShouldDehydrateQuery(query),
        },
      }}
    >
      <ThemeProvider>
        <RouterProvider router={router} />
        <PwaUpdateNotice />
        <AppToaster />
      </ThemeProvider>
    </PersistQueryClientProvider>
  </StrictMode>
)
