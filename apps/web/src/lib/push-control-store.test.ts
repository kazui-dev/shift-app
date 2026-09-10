import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import {
  getPushControlState,
  initializePushControl,
} from "./push-control-store"

afterEach(() => vi.unstubAllGlobals())

describe("push control initialization", () => {
  it("loads the browser subscription once before settings consumes it", async () => {
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
      pending: false,
    })
  })
})
