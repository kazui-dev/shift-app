import { afterEach, expect, it, vi } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import type { AuthState } from "@workspace/shared/auth"
import { keys } from "@/data/keys"
import { resolveAccountState, verifyAccountState } from "@/lib/account/state"

const storage = vi.hoisted(() => ({
  load: vi.fn<() => Promise<Extract<AuthState, { status: "active" }> | null>>(),
  save: vi.fn<() => Promise<void>>(),
  clear: vi.fn<() => Promise<void>>(),
  account: vi.fn<() => Promise<AuthState>>(),
}))
vi.mock("./offline", () => ({
  loadOfflineAccount: storage.load,
  saveOfflineAccount: storage.save,
  clearOfflineAccount: storage.clear,
}))
vi.mock("@/api/account", () => ({ getAccountState: storage.account }))
vi.mock("@/data/query-client", () => ({
  clearPersistedUserData: vi.fn<() => Promise<void>>(),
}))
const account: AuthState = {
  status: "active",
  member: {
    id: "10000000-0000-4000-8000-000000000001",
    image: null,
    displayName: "Test",
    studentId: "26AJ001",
    accessLevel: "member",
  },
  providers: { discord: true },
  linkedProviders: ["discord"],
}
/** A client restored with the member's startup data. */
function restoredClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(keys.displayYear(), { year: 2026 })
  return client
}
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it("answers every page from the kept account until the server has answered", async () => {
  vi.stubGlobal("navigator", { onLine: true })
  storage.load.mockResolvedValue(account)
  storage.account.mockResolvedValue(account)
  const client = restoredClient()
  const kept = { state: account, offline: false, checking: true }
  expect(await resolveAccountState(client)).toEqual(kept)
  expect(await resolveAccountState(client)).toEqual(kept)
  expect(storage.account).not.toHaveBeenCalled()
  expect(await verifyAccountState(client)).toEqual({
    state: account,
    offline: false,
  })
  expect(await resolveAccountState(client)).toEqual({
    state: account,
    offline: false,
  })
  expect(storage.account).toHaveBeenCalledTimes(2)
  client.clear()
})

it("asks the server when the device keeps no account or no startup data", async () => {
  vi.stubGlobal("navigator", { onLine: true })
  storage.account.mockResolvedValue(account)
  storage.load.mockResolvedValue(null)
  const verified = { state: account, offline: false }
  expect(await resolveAccountState(restoredClient())).toEqual(verified)
  storage.load.mockResolvedValue(account)
  const empty = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  expect(await resolveAccountState(empty)).toEqual(verified)
  expect(storage.account).toHaveBeenCalledTimes(2)
})

it("stops answering from the kept account even when verification fails", async () => {
  vi.stubGlobal("navigator", { onLine: true })
  storage.load.mockResolvedValue(account)
  storage.account.mockRejectedValue(new Error("server failed"))
  const client = restoredClient()
  await expect(verifyAccountState(client)).rejects.toThrow("server failed")
  await expect(resolveAccountState(client)).rejects.toThrow("server failed")
})
