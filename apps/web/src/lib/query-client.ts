import { resetPushControl } from "./push-control-store"
import { keyRoot, keys, persistedKeys, roomKeys } from "@/data/keys"
import { boundPersistedClient } from "@/data/persistence"
import { QueryCache, QueryClient } from "@tanstack/react-query"
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client"
import { del, get, set } from "idb-keyval"

import { toast } from "@workspace/ui/lib/toast"
import { ApiError, errorMessage } from "@/api/client"
import { clearChatImages } from "./chat-images"
import { clearChatStorage } from "./chat-store"

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000
const PERSISTED_QUERY_KEY = "shift-app-query-cache"
const persistedRoots = new Set([...persistedKeys.keys()].map(keyRoot))

export function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && persistedRoots.has(queryKey[0])
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const root = String(query.queryKey[0])
      if (
        root === keyRoot(keys.account) ||
        root === keyRoot(keys.chatLinkPreview) ||
        !navigator.onLine
      )
        return
      // Missing chat resources are handled by chat navigation, including deletion races.
      if (
        error instanceof ApiError &&
        error.status === 404 &&
        roomKeys.map(keyRoot).includes(root)
      )
        return
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
      retry: (count, error) =>
        !(error instanceof ApiError && error.status === 404) && count < 1,
    },
  },
})

export const persister: Persister = {
  persistClient: (client: PersistedClient) =>
    set(PERSISTED_QUERY_KEY, boundPersistedClient(client)),
  restoreClient: () => get<PersistedClient>(PERSISTED_QUERY_KEY),
  removeClient: () => del(PERSISTED_QUERY_KEY),
}

export async function clearPersistedUserData(
  client: QueryClient
): Promise<void> {
  resetPushControl()
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== keyRoot(keys.account),
  })
  client.getMutationCache().clear()
  await persister.removeClient()
  clearChatImages()
  await clearChatStorage()
}
