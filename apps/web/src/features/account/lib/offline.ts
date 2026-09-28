import { del, get, set } from "idb-keyval"
import * as v from "valibot"

import { authStateSchema, type AuthState } from "@workspace/shared/auth"

const offlineAccountKey = "shift-app-offline-account"
export const offlineAccountMaxAge = 24 * 60 * 60 * 1000

export type ActiveAccountState = Extract<AuthState, { status: "active" }>

type OfflineAccountSnapshot = {
  state: ActiveAccountState
  verifiedAt: number
}

export function parseOfflineAccountSnapshot(
  value: unknown,
  now = Date.now()
): OfflineAccountSnapshot | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("state" in value) ||
    !("verifiedAt" in value) ||
    typeof value.verifiedAt !== "number" ||
    !Number.isInteger(value.verifiedAt) ||
    value.verifiedAt > now ||
    now - value.verifiedAt > offlineAccountMaxAge
  ) {
    return null
  }

  const parsed = v.safeParse(authStateSchema, value.state)
  if (!parsed.success || parsed.output.status !== "active") return null

  return { state: parsed.output, verifiedAt: value.verifiedAt }
}

export async function loadOfflineAccount(): Promise<ActiveAccountState | null> {
  const value = await get<unknown>(offlineAccountKey)
  const snapshot = parseOfflineAccountSnapshot(value)
  if (snapshot) return snapshot.state
  if (value !== undefined) await del(offlineAccountKey)
  return null
}

export const saveOfflineAccount = (state: ActiveAccountState) =>
  set(offlineAccountKey, { state, verifiedAt: Date.now() })

export const clearOfflineAccount = () => del(offlineAccountKey)
