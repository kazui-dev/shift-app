import { QueryCache, QueryClient } from "@tanstack/react-query"
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client"
import { del, get, set } from "idb-keyval"

import { toast } from "@workspace/ui/lib/toast"
import { errorMessage } from "@/api/client"
import { sendChatMessage } from "@/api/chat"

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const PERSISTED_QUERY_KEY = "shift-app-query-cache"
const persistedQueryRoots = new Set([
  "assignments",
  "display-year",
  "chat-rooms",
  "chat-messages",
])

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && persistedQueryRoots.has(queryKey[0])
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] === "account" || !navigator.onLine) return
      toast.error(errorMessage(error), { id: `query:${query.queryHash}` })
    },
    onSuccess: (_data, query) => {
      toast.dismiss(`query:${query.queryHash}`)
    },
  }),
  defaultOptions: {
    queries: {
      gcTime: DAY_IN_MILLISECONDS,
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
})

queryClient.setMutationDefaults(["send-chat-message"], {
  mutationFn: (variables: { roomId: string; id: string; content: string }) =>
    sendChatMessage(variables.roomId, variables),
})

export const persister: Persister = {
  persistClient: (client: PersistedClient) => set(PERSISTED_QUERY_KEY, client),
  restoreClient: () => get<PersistedClient>(PERSISTED_QUERY_KEY),
  removeClient: () => del(PERSISTED_QUERY_KEY),
}

export async function clearPersistedUserData(
  client: QueryClient
): Promise<void> {
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== "account",
  })
  client.getMutationCache().clear()
  await persister.removeClient()
}
