import { QueryClient } from "@tanstack/react-query"
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client"
import { del, get, set } from "idb-keyval"

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const PERSISTED_QUERY_KEY = "shift-app-query-cache"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: DAY_IN_MILLISECONDS,
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
})

export const persister: Persister = {
  persistClient: (client: PersistedClient) => set(PERSISTED_QUERY_KEY, client),
  restoreClient: () => get<PersistedClient>(PERSISTED_QUERY_KEY),
  removeClient: () => del(PERSISTED_QUERY_KEY),
}
