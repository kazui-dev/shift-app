import { afterEach, describe, expect, it, vi } from "vite-plus/test"

afterEach(() => vi.unstubAllGlobals())

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
    await synchronization

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
    ).resolves.toEqual({ status: "failed", error })
    expect(getPushControlState()).toEqual({
      confirmedEnabled: false,
      enabled: false,
      syncing: false,
    })
  })
})
