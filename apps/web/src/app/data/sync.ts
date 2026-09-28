import type { QueryClient } from "@tanstack/react-query"
import { keyRoot, membershipKeys } from "./keys"

const roots = new Set(membershipKeys.map(keyRoot))

/** Membership changes affect visibility and permissions across these resources. */
export function refreshMemberships(client: QueryClient) {
  return client.invalidateQueries({
    predicate: (query) => roots.has(String(query.queryKey[0])),
  })
}
