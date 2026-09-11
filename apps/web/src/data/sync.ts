import type { QueryClient } from "@tanstack/react-query"

const membershipRoots = new Set([
  "years",
  "display-year",
  "roster",
  "year-roles",
  "year-memberships",
  "activities",
  "activity-editor",
  "assignments",
  "chat-rooms",
  "chat-room",
  "chat-settings",
  "chat-targets",
  "chat-members",
  "admin",
  "shift-attendance",
])
/** Membership changes affect visibility and permissions across these resources. */
export function refreshMemberships(client: QueryClient) {
  return client.invalidateQueries({
    predicate: (query) => membershipRoots.has(String(query.queryKey[0])),
  })
}
