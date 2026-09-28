import { queryOptions, type QueryClient } from "@tanstack/react-query"
import { keys } from "@/app/data/keys"

import type { AuthState } from "@workspace/shared/auth"

import { getAccountState } from "@/features/account/api/account"
import { ApiError, ApiNetworkError } from "@/lib/http/client"
import {
  clearOfflineAccount,
  loadOfflineAccount,
  saveOfflineAccount,
  type ActiveAccountState,
} from "@/features/account/lib/offline"
import { clearPersistedUserData } from "@/app/data/query-client"

export const accountStateQueryOptions = queryOptions({
  queryKey: keys.account(),
  queryFn: getAccountState,
  networkMode: "always",
  retry: false,
  meta: { persist: false },
})

export type ResolvedAccountState = {
  state: AuthState
  offline: boolean
  checking?: boolean
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

/** Clients whose account the server has answered for since the app started. */
const verifiedClients = new WeakSet<QueryClient>()

/**
 * The member's account for any page. Until the server has answered once, a
 * verified account kept on this device answers at once with `checking`, as
 * long as the cache also holds the member's startup data, so every page
 * renders from the cache while the app verifies in the background.
 */
export async function resolveAccountState(
  queryClient: QueryClient
): Promise<ResolvedAccountState> {
  if (
    !verifiedClients.has(queryClient) &&
    navigator.onLine &&
    queryClient.getQueryData(keys.displayYear()) !== undefined
  ) {
    const cached = await loadOfflineAccount()
    if (cached) return { state: cached, offline: false, checking: true }
  }
  return verifyAccountState(queryClient)
}

/** Asks the server for the account; later resolutions no longer answer from the kept one. */
export async function verifyAccountState(
  queryClient: QueryClient
): Promise<ResolvedAccountState> {
  try {
    return await resolveWithServer(queryClient)
  } finally {
    verifiedClients.add(queryClient)
  }
}

function resolveWithServer(queryClient: QueryClient) {
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
