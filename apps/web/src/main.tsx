import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { defaultShouldDehydrateQuery } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createRouter, RouterProvider } from "@tanstack/react-router"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { persister, queryClient } from "@/lib/query-client.ts"
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

createRoot(rootElement).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: "shift-app-cache-2026-08",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.meta?.persist !== false && defaultShouldDehydrateQuery(query),
        },
      }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </PersistQueryClientProvider>
  </StrictMode>
)
