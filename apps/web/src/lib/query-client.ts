import { QueryClient } from "@tanstack/react-query"
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client"
import { del, get, set } from "idb-keyval"

import { sendChatMessage } from "./chat-api"

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

queryClient.setMutationDefaults(["send-chat-message"], {
  mutationFn: (variables: { roomId: string; id: string; content: string }) =>
    sendChatMessage(variables.roomId, variables),
})

export const persister: Persister = {
  persistClient: (client: PersistedClient) => set(PERSISTED_QUERY_KEY, client),
  restoreClient: () => get<PersistedClient>(PERSISTED_QUERY_KEY),
  removeClient: () => del(PERSISTED_QUERY_KEY),
}
