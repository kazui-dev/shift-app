import { queryOptions, type QueryClient } from "@tanstack/react-query"

import type { AuthState } from "@workspace/shared/auth"

import { getAccountState } from "@/api/account"
import { ApiError, ApiNetworkError } from "@/api/client"
import {
  clearOfflineAccount,
  loadOfflineAccount,
  saveOfflineAccount,
  type ActiveAccountState,
} from "@/lib/offline-account"
import { clearPersistedUserData } from "@/lib/query-client"

export const accountStateQueryOptions = queryOptions({
  queryKey: ["account"],
  queryFn: getAccountState,
  networkMode: "always",
  retry: false,
  meta: { persist: false },
})

export type ResolvedAccountState = {
  state: AuthState
  offline: boolean
}

export class OfflineAccountUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("No verified offline account is available", options)
    this.name = "OfflineAccountUnavailableError"
  }
}

type AccountStateServices = {
  isOnline: () => boolean
  loadCached: () => Promise<ActiveAccountState | null>
  fetchCurrent: () => Promise<AuthState>
  saveCurrent: (state: ActiveAccountState) => Promise<void>
  clearCachedUser: () => Promise<void>
}

export async function resolveAccountStateWith({
  isOnline,
  loadCached,
  fetchCurrent,
  saveCurrent,
  clearCachedUser,
}: AccountStateServices): Promise<ResolvedAccountState> {
  const cached = await loadCached()
  if (!isOnline()) {
    if (cached) return { state: cached, offline: true }
    throw new OfflineAccountUnavailableError()
  }

  let state: AuthState
  try {
    state = await fetchCurrent()
  } catch (error) {
    if (error instanceof ApiNetworkError) {
      if (cached) return { state: cached, offline: true }
      throw new OfflineAccountUnavailableError({ cause: error })
    }
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      await clearCachedUser()
    }
    throw error
  }

  if (state.status !== "active") {
    await clearCachedUser()
    return { state, offline: false }
  }

  if (!cached || cached.member.studentId !== state.member.studentId) {
    await clearCachedUser()
  }
  await saveCurrent(state)
  return { state, offline: false }
}

export function resolveAccountState(
  queryClient: QueryClient
): Promise<ResolvedAccountState> {
  return resolveAccountStateWith({
    isOnline: () => navigator.onLine,
    loadCached: loadOfflineAccount,
    fetchCurrent: () => queryClient.fetchQuery(accountStateQueryOptions),
    saveCurrent: async (state) => saveOfflineAccount(state),
    clearCachedUser: async () => {
      await clearOfflineAccount()
      await clearPersistedUserData(queryClient)
    },
  })
}
