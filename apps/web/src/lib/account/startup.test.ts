import { afterEach, expect, it, vi } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import type { AuthState } from "@workspace/shared/auth"
import { resolveAccountState } from "@/lib/account/state"

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
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it("restores a verified reading session once and then verifies against the server", async () => {
  vi.stubGlobal("navigator", { onLine: true })
  storage.load.mockResolvedValue(account)
  let finish: (value: AuthState) => void = () => {}
  const pending = new Promise<AuthState>((resolve) => {
    finish = resolve
  })
  storage.account.mockReturnValue(pending)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  expect(await resolveAccountState(client, true)).toEqual({
    state: account,
    offline: false,
    checking: true,
  })
  expect(storage.account).not.toHaveBeenCalled()
  const verified = resolveAccountState(client, true)
  finish(account)
  expect(await verified).toEqual({ state: account, offline: false })
  expect(storage.account).toHaveBeenCalledOnce()
  client.clear()
})

it("does not skip verification for ordinary navigation or an expired reading session", async () => {
  vi.stubGlobal("navigator", { onLine: true })
  storage.load.mockResolvedValue(account)
  storage.account.mockResolvedValue(account)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  expect(await resolveAccountState(client)).toEqual({
    state: account,
    offline: false,
  })
  expect(storage.account).toHaveBeenCalledOnce()
  client.clear()
  storage.load.mockResolvedValue(null)
  expect(await resolveAccountState(client, true)).toEqual({
    state: account,
    offline: false,
  })
  expect(storage.account).toHaveBeenCalledTimes(2)
  client.clear()
})
