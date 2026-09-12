import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import {
  loadPushControlIntent,
  savePushControlIntent,
} from "./push-control-intent"

beforeEach(() => vi.stubGlobal("Notification", { permission: "granted" }))
afterEach(() => vi.unstubAllGlobals())

function memoryStorage(): Pick<Storage, "getItem" | "removeItem" | "setItem"> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

describe("push control store", () => {
  it("loads the browser subscription once before settings consumes it", async () => {
    vi.resetModules()
    const { getPushControlState, initializePushControl } =
      await import("./push-control-store")
    const getSubscription = vi
      .fn<() => Promise<{ endpoint: string } | null>>()
      .mockResolvedValue({ endpoint: "push" })
    const getRegistration = vi
      .fn<
        () => Promise<
          | { pushManager: { getSubscription: typeof getSubscription } }
          | undefined
        >
      >()
      .mockResolvedValue({ pushManager: { getSubscription } })
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } })
    vi.stubGlobal("window", {
      Notification: () => undefined,
      PushManager: () => undefined,
    })

    await Promise.all([initializePushControl(), initializePushControl()])

    expect(getRegistration).toHaveBeenCalledOnce()
    expect(getSubscription).toHaveBeenCalledOnce()
    expect(getPushControlState()).toMatchObject({
      confirmedEnabled: true,
      enabled: true,
      syncing: false,
    })
  })

  it("serializes work and converges on the latest requested state", async () => {
    vi.resetModules()
    const {
      getPushControlState,
      initializePushControl,
      requestPushControlState,
      synchronizePushControl,
    } = await import("./push-control-store")
    let finishEnable: (() => void) | undefined
    const sync = vi.fn<(enabled: boolean) => Promise<void>>((enabled) => {
      if (!enabled) return Promise.resolve()
      return new Promise((resolve) => {
        finishEnable = resolve
      })
    })
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve(null) },
          }),
      },
    })
    vi.stubGlobal("window", {
      Notification: () => undefined,
      PushManager: () => undefined,
    })
    await initializePushControl()

    expect(requestPushControlState(true)).toBe(true)
    const synchronization = synchronizePushControl(sync)
    expect(synchronization).not.toBeNull()
    expect(requestPushControlState(false)).toBe(true)
    expect(synchronizePushControl(sync)).toBeNull()
    finishEnable?.()
    await expect(synchronization).resolves.toBeUndefined()

    expect(sync.mock.calls).toEqual([[true], [false]])
    expect(getPushControlState()).toEqual({
      confirmedEnabled: false,
      enabled: false,
      syncing: false,
    })
  })

  it("rolls back only when the latest requested state fails", async () => {
    vi.resetModules()
    const {
      getPushControlState,
      initializePushControl,
      requestPushControlState,
      synchronizePushControl,
    } = await import("./push-control-store")
    const error = new Error("failed")
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve(null) },
          }),
      },
    })
    vi.stubGlobal("window", {
      Notification: () => undefined,
      PushManager: () => undefined,
    })
    await initializePushControl()
    requestPushControlState(true)

    await expect(
      synchronizePushControl(() => Promise.reject(error))
    ).rejects.toBe(error)
    expect(getPushControlState()).toEqual({
      confirmedEnabled: false,
      enabled: false,
      syncing: false,
    })
  })

  it("restores an interrupted request and clears it after syncing", async () => {
    vi.resetModules()
    const initialStore = await import("./push-control-store")
    const storage = memoryStorage()
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve(null) },
          }),
      },
    })
    vi.stubGlobal("window", {
      Notification: () => undefined,
      PushManager: () => undefined,
      sessionStorage: storage,
    })

    await initialStore.preparePushControl("26AJ001")
    initialStore.requestPushControlState(true)

    expect(loadPushControlIntent(storage, "26AJ001")).toBe(true)

    vi.resetModules()
    const restoredStore = await import("./push-control-store")
    await restoredStore.preparePushControl("26AJ001")

    expect(restoredStore.getPushControlState()).toEqual({
      confirmedEnabled: false,
      enabled: true,
      syncing: true,
    })
    await restoredStore.synchronizePushControl(() => Promise.resolve())
    expect(loadPushControlIntent(storage, "26AJ001")).toBeNull()
    expect(restoredStore.getPushControlState()).toEqual({
      confirmedEnabled: true,
      enabled: true,
      syncing: false,
    })
  })

  it("clears a restored request when the user returns to the confirmed state", async () => {
    vi.resetModules()
    const {
      getPushControlState,
      preparePushControl,
      requestPushControlState,
      synchronizePushControl,
    } = await import("./push-control-store")
    const storage = memoryStorage()
    savePushControlIntent(storage, "26AJ001", true)
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: { getSubscription: () => Promise.resolve(null) },
          }),
      },
    })
    vi.stubGlobal("window", {
      Notification: () => undefined,
      PushManager: () => undefined,
      sessionStorage: storage,
    })
    await preparePushControl("26AJ001")

    requestPushControlState(false)

    expect(synchronizePushControl(() => Promise.resolve())).toBeNull()
    expect(loadPushControlIntent(storage, "26AJ001")).toBeNull()
    expect(getPushControlState()).toEqual({
      confirmedEnabled: false,
      enabled: false,
      syncing: false,
    })
  })
})

it("refreshes external permission changes without replacing a pending user choice", async () => {
  vi.resetModules()
  const store = await import("./push-control-store")
  let permission: PermissionState = "granted"
  const subscription = { endpoint: "push" }
  const getSubscription = vi.fn<() => Promise<typeof subscription>>(
    async () => subscription
  )
  vi.stubGlobal("navigator", {
    permissions: { query: async () => ({ state: permission }) },
    serviceWorker: {
      getRegistration: async () => ({ pushManager: { getSubscription } }),
    },
  })
  vi.stubGlobal("window", { Notification: {}, PushManager: {} })
  await store.initializePushControl()
  expect(store.getPushControlState().enabled).toBe(true)
  permission = "denied"
  await store.refreshPushControl()
  expect(store.getPushControlState().enabled).toBe(false)
  permission = "granted"
  await store.refreshPushControl()
  expect(store.getPushControlState().enabled).toBe(true)
  const refresh = store.refreshPushControl()
  store.requestPushControlState(false)
  await refresh
  expect(store.getPushControlState()).toMatchObject({
    enabled: false,
    syncing: true,
  })
  await store.refreshPushControl()
  expect(store.getPushControlState().enabled).toBe(false)
})

it("reads again when permission changes during an in-flight device read", async () => {
  vi.resetModules()
  const store = await import("./push-control-store")
  let permission: PermissionState = "granted"
  let finish: ((value: { endpoint: string }) => void) | undefined
  const getSubscription = vi
    .fn<() => Promise<{ endpoint: string }>>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    .mockResolvedValue({ endpoint: "push" })
  vi.stubGlobal("navigator", {
    permissions: { query: async () => ({ state: permission }) },
    serviceWorker: {
      getRegistration: async () => ({ pushManager: { getSubscription } }),
    },
  })
  vi.stubGlobal("window", { Notification: {}, PushManager: {} })
  const reading = store.initializePushControl()
  await vi.waitFor(() => expect(getSubscription).toHaveBeenCalledOnce())
  permission = "denied"
  const refreshed = store.refreshPushControl()
  finish?.({ endpoint: "push" })
  await Promise.all([reading, refreshed])
  expect(getSubscription).toHaveBeenCalledTimes(2)
  expect(store.getPushControlState().enabled).toBe(false)
})
