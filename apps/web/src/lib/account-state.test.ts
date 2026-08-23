import { describe, expect, it, vi } from "vite-plus/test"

import type { AuthState } from "@workspace/shared/auth"

import { ApiError, ApiNetworkError } from "@/api/client"
import {
  OfflineAccountUnavailableError,
  resolveAccountStateWith,
} from "@/lib/account-state"
import {
  offlineAccountMaxAge,
  parseOfflineAccountSnapshot,
  type ActiveAccountState,
} from "@/lib/offline-account"
import { shouldPersistQueryKey } from "@/lib/query-client"

const activeAccount = (studentId: string): ActiveAccountState => ({
  status: "active",
  member: {
    displayName: "電大太郎",
    studentId,
    accessLevel: "member",
  },
  providers: { discord: true },
  linkedProviders: ["discord"],
})

function services({
  online = true,
  cached = activeAccount("26AJ000"),
  current = activeAccount("26AJ000"),
}: {
  online?: boolean
  cached?: ActiveAccountState | null
  current?: AuthState
} = {}) {
  return {
    isOnline: vi.fn<() => boolean>(() => online),
    loadCached: vi.fn<() => Promise<ActiveAccountState | null>>(
      async () => cached
    ),
    fetchCurrent: vi.fn<() => Promise<AuthState>>(async () => current),
    saveCurrent: vi.fn<(state: ActiveAccountState) => Promise<void>>(
      async () => undefined
    ),
    clearCachedUser: vi.fn<() => Promise<void>>(async () => undefined),
  }
}

describe("offline account resolution", () => {
  it("opens cached account data without contacting the server when offline", async () => {
    const dependencies = services({ online: false })

    await expect(resolveAccountStateWith(dependencies)).resolves.toMatchObject({
      offline: true,
      state: { status: "active" },
    })
    expect(dependencies.fetchCurrent).not.toHaveBeenCalled()
  })

  it("falls back only for a network failure", async () => {
    const dependencies = services()
    dependencies.fetchCurrent.mockRejectedValueOnce(
      new ApiNetworkError(new TypeError("offline"))
    )

    await expect(resolveAccountStateWith(dependencies)).resolves.toMatchObject({
      offline: true,
    })
    expect(dependencies.clearCachedUser).not.toHaveBeenCalled()
  })

  it("does not open without a verified cached account", async () => {
    const dependencies = services({ online: false, cached: null })

    await expect(resolveAccountStateWith(dependencies)).rejects.toBeInstanceOf(
      OfflineAccountUnavailableError
    )
  })

  it("reports unavailable when the network fails without cached account", async () => {
    const dependencies = services({ cached: null })
    dependencies.fetchCurrent.mockRejectedValueOnce(
      new ApiNetworkError(new TypeError("offline"))
    )

    await expect(resolveAccountStateWith(dependencies)).rejects.toBeInstanceOf(
      OfflineAccountUnavailableError
    )
  })

  it("clears cached user data after an authorization failure", async () => {
    const dependencies = services()
    dependencies.fetchCurrent.mockRejectedValueOnce(
      new ApiError("Authentication is required", 401, "UNAUTHORIZED")
    )

    await expect(resolveAccountStateWith(dependencies)).rejects.toBeInstanceOf(
      ApiError
    )
    expect(dependencies.clearCachedUser).toHaveBeenCalledOnce()
  })

  it("separates persisted data when the verified user changes", async () => {
    const next = activeAccount("26AJ001")
    const dependencies = services({ current: next })

    await expect(resolveAccountStateWith(dependencies)).resolves.toEqual({
      state: next,
      offline: false,
    })
    expect(dependencies.clearCachedUser).toHaveBeenCalledOnce()
    expect(dependencies.saveCurrent).toHaveBeenCalledWith(next)
  })

  it("keeps persisted data for the same verified user", async () => {
    const dependencies = services()

    await expect(resolveAccountStateWith(dependencies)).resolves.toMatchObject({
      offline: false,
    })
    expect(dependencies.clearCachedUser).not.toHaveBeenCalled()
    expect(dependencies.saveCurrent).toHaveBeenCalledOnce()
  })

  it("does not hide non-authorization server errors", async () => {
    const dependencies = services()
    dependencies.fetchCurrent.mockRejectedValueOnce(
      new ApiError("Server error", 500, "REQUEST_FAILED")
    )

    await expect(resolveAccountStateWith(dependencies)).rejects.toBeInstanceOf(
      ApiError
    )
    expect(dependencies.clearCachedUser).not.toHaveBeenCalled()
  })

  it("clears cached user data for a signed-out response", async () => {
    const anonymous: AuthState = {
      status: "anonymous",
      providers: { discord: true },
    }
    const dependencies = services({ current: anonymous })

    await expect(resolveAccountStateWith(dependencies)).resolves.toEqual({
      state: anonymous,
      offline: false,
    })
    expect(dependencies.clearCachedUser).toHaveBeenCalledOnce()
    expect(dependencies.saveCurrent).not.toHaveBeenCalled()
  })
})

describe("offline account snapshot", () => {
  it("accepts an active account verified within 24 hours", () => {
    const now = Date.now()
    const state = activeAccount("26AJ000")

    expect(
      parseOfflineAccountSnapshot({ state, verifiedAt: now - 1_000 }, now)
    ).toEqual({ state, verifiedAt: now - 1_000 })
  })

  it("rejects expired and future snapshots", () => {
    const now = Date.now()
    const state = activeAccount("26AJ000")

    expect(
      parseOfflineAccountSnapshot(
        { state, verifiedAt: now - offlineAccountMaxAge - 1 },
        now
      )
    ).toBeNull()
    expect(
      parseOfflineAccountSnapshot({ state, verifiedAt: now + 1 }, now)
    ).toBeNull()
  })

  it("rejects malformed and non-active snapshots", () => {
    const now = Date.now()

    expect(parseOfflineAccountSnapshot(null, now)).toBeNull()
    expect(parseOfflineAccountSnapshot({}, now)).toBeNull()
    expect(
      parseOfflineAccountSnapshot(
        { state: activeAccount("26AJ000"), verifiedAt: 1.5 },
        now
      )
    ).toBeNull()
    expect(
      parseOfflineAccountSnapshot(
        {
          state: { status: "anonymous", providers: { discord: true } },
          verifiedAt: now,
        },
        now
      )
    ).toBeNull()
    expect(
      parseOfflineAccountSnapshot(
        { state: { status: "active" }, verifiedAt: now },
        now
      )
    ).toBeNull()
  })
})

describe("persisted query allowlist", () => {
  it("keeps offline reads and excludes administrative data", () => {
    expect(shouldPersistQueryKey(["assignments", "2026-11-01"])).toBe(true)
    expect(shouldPersistQueryKey(["chat-rooms"])).toBe(true)
    expect(shouldPersistQueryKey(["chat-messages", "room-id"])).toBe(true)
    expect(shouldPersistQueryKey(["admin", "members"])).toBe(false)
    expect(shouldPersistQueryKey(["years"])).toBe(false)
    expect(shouldPersistQueryKey(["account"])).toBe(false)
  })
})
