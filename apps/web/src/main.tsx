import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import {
  defaultShouldDehydrateQuery,
  QueryClientProvider,
} from "@tanstack/react-query"
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/react-query-persist-client"
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
} from "@/data/query-client.ts"
import { pruneCachedImages } from "@/lib/chat/image-cache"
import { routeTree } from "./routeTree.gen.ts"

void pruneCachedImages()

const router = createRouter({
  routeTree,
  context: { queryClient },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const persistOptions = {
  queryClient,
  persister,
  buster: "shift-app-cache-2026-09-chat-v7",
  dehydrateOptions: {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (
      query: Parameters<typeof defaultShouldDehydrateQuery>[0]
    ) =>
      query.meta?.persist !== false &&
      shouldPersistQueryKey(query.queryKey) &&
      defaultShouldDehydrateQuery(query),
  },
}

/** Loads the current location, following up to a few redirects until it settles. */
async function load(redirects = 3): Promise<void> {
  await router.load()
  if (
    redirects > 0 &&
    router.state.resolvedLocation?.href !== router.latestLocation.href
  )
    return load(redirects - 1)
}

/**
 * Restores the cache and resolves the first route, its code included, before
 * React commits anything. A commit before either finishes renders nothing,
 * which replaces the page with its bare background until they do.
 */
async function start(root: HTMLElement) {
  await persistQueryClientRestore(persistOptions).catch(() => undefined)
  persistQueryClientSubscribe(persistOptions)
  await load()
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
          <PwaUpdateNotice />
          <AppToaster />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Application root element was not found")
}
void start(rootElement)
