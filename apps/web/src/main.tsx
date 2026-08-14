import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: "shift-app-v1",
      }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </PersistQueryClientProvider>
  </StrictMode>
)
