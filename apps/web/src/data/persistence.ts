import type { PersistedClient } from "@tanstack/react-query-persist-client"
import { keyRoot, keys, persistedKeys } from "./keys"
import * as v from "valibot"
import { chatMessagesResponseSchema } from "@workspace/shared/communications"

const historySchema = v.object({
  pages: v.array(chatMessagesResponseSchema),
  pageParams: v.array(v.nullable(v.number())),
})
const limits = new Map(
  [...persistedKeys].map(([key, limit]) => [keyRoot(key), limit])
)

/** Persist recent reading context, never an unbounded copy of chat history. */
export function boundPersistedClient(client: PersistedClient): PersistedClient {
  const counts = new Map<string, number>()
  const queries = client.clientState.queries
    .toSorted((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .flatMap((query) => {
      const root = String(query.queryKey[0])
      const limit = limits.get(root) ?? 0
      const count = counts.get(root) ?? 0
      if (count >= limit) return []
      counts.set(root, count + 1)
      if (root !== keyRoot(keys.chatMessages)) return [query]
      const parsed = v.safeParse(historySchema, query.state.data)
      if (
        !parsed.success ||
        parsed.output.pages.length !== parsed.output.pageParams.length
      )
        return []
      const first = parsed.output.pages[0]
      const expanded = first && first.messages.length > 100
      const pages = expanded
        ? [{ messages: first.messages.slice(-100), hasMore: true }]
        : parsed.output.pages.slice(0, 3)
      const pageParams = expanded
        ? [null]
        : parsed.output.pageParams.slice(0, 3)
      return [
        {
          ...query,
          state: {
            ...query.state,
            data: {
              pages,
              pageParams,
            },
          },
        },
      ]
    })
  return { ...client, clientState: { ...client.clientState, queries } }
}
