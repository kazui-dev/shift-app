import { queryOptions } from "@tanstack/react-query"

import { authStateSchema } from "@workspace/shared/auth"

export async function getAuthState() {
  const response = await fetch("/api/auth-state", { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Auth API returned ${response.status}`)
  }
  return authStateSchema.parse(await response.json())
}

export const authStateQueryOptions = queryOptions({
  queryKey: ["auth-state"],
  queryFn: getAuthState,
  retry: false,
  meta: { persist: false },
})
