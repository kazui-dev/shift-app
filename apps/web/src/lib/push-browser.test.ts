import { afterEach, expect, it, vi } from "vite-plus/test"
import { prepareBrowserPush } from "./push-browser"
vi.mock("@/api/push", () => ({
  getPushConfig: vi.fn<() => Promise<{ publicKey: string }>>(async () => ({
    publicKey: "AQID",
  })),
  base64UrlBytes: (value: string) =>
    Uint8Array.from(atob(value), (letter) => letter.charCodeAt(0)),
}))
vi.mock("./push-diagnostics", () => ({ recordPushStep: vi.fn<() => void>() }))
afterEach(() => vi.unstubAllGlobals())
it("subscribes using the prepared registration even when permission reads say denied", async () => {
  const subscription = {
    expirationTime: null,
    toJSON: () => ({
      endpoint: "https://push.example/test",
      keys: { p256dh: "key", auth: "auth" },
    }),
  }
  const subscribe = vi.fn<() => Promise<typeof subscription>>(
    async () => subscription
  )
  const requestPermission = vi.fn<() => Promise<string>>(async () => "denied")
  vi.stubGlobal("Notification", { permission: "denied", requestPermission })
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => undefined,
      ready: Promise.resolve({
        pushManager: { subscribe, getSubscription: async () => null },
      }),
    },
  })
  const browser = await prepareBrowserPush()
  const subscribing = browser.subscribe()
  expect(subscribe).toHaveBeenCalledOnce()
  expect(await subscribing).toMatchObject({
    endpoint: "https://push.example/test",
    expirationTime: null,
  })
  expect(requestPermission).not.toHaveBeenCalled()
  expect(await browser.read()).toEqual({
    permission: "denied",
    subscription: null,
  })
})
