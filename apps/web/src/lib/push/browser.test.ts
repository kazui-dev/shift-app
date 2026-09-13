import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { getPushConfig } from "@/api/push"
import {
  pushSupported,
  readPushSubscription,
  subscribePush,
  withPushLock,
} from "@/lib/push/browser"
vi.mock("@/api/push", async (original) => ({
  ...(await original<typeof import("@/api/push")>()),
  getPushConfig: vi.fn<typeof getPushConfig>(),
}))
const unsubscribe = vi.fn<() => Promise<boolean>>()
const sub = {
  endpoint: "https://push.example/1",
  expirationTime: null,
  options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
  unsubscribe,
  toJSON: () => ({
    endpoint: "https://push.example/1",
    keys: { p256dh: "key", auth: "auth" },
  }),
}
const getSubscription = vi.fn<() => Promise<typeof sub | null>>()
const subscribe = vi.fn<() => Promise<typeof sub>>()
const registration = { active: {}, pushManager: { getSubscription, subscribe } }
const getRegistration = vi.fn<() => Promise<typeof registration | undefined>>()
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getPushConfig).mockResolvedValue({ publicKey: "AQID" })
  unsubscribe.mockResolvedValue(true)
  getSubscription.mockResolvedValue(null)
  subscribe.mockResolvedValue(sub)
  getRegistration.mockResolvedValue(registration)
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration } })
  vi.stubGlobal("window", {
    isSecureContext: true,
    PushManager: {},
    Notification: {},
  })
})
afterEach(() => vi.unstubAllGlobals())
it("requires secure context and all browser APIs", () => {
  expect(pushSupported()).toBe(true)
  vi.stubGlobal("window", {
    isSecureContext: false,
    PushManager: {},
    Notification: {},
  })
  expect(pushSupported()).toBe(false)
  vi.stubGlobal("window", { isSecureContext: true })
  expect(pushSupported()).toBe(false)
})
it("startup only reads an existing registration and never subscribes", async () => {
  getRegistration.mockResolvedValue(undefined)
  expect(await readPushSubscription()).toBeNull()
  expect(subscribe).not.toHaveBeenCalled()
})
it("fails promptly when the app service worker is not registered", async () => {
  getRegistration.mockResolvedValue(undefined)
  await expect(subscribePush()).rejects.toThrow("Service worker is not active")
})
it("uses user-visible push with the decoded application key", async () => {
  await subscribePush()
  expect(subscribe).toHaveBeenCalledWith({
    userVisibleOnly: true,
    applicationServerKey: new Uint8Array([1, 2, 3]),
  })
  expect(unsubscribe).not.toHaveBeenCalled()
})
it("reuses a subscription with the same VAPID key", async () => {
  getSubscription.mockResolvedValue(sub)
  await subscribePush()
  expect(unsubscribe).not.toHaveBeenCalled()
})
it("rotates a subscription when the application key changes", async () => {
  getSubscription.mockResolvedValue({
    ...sub,
    options: { applicationServerKey: new Uint8Array([3, 2, 1]).buffer },
  })
  await subscribePush()
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(subscribe).toHaveBeenCalledOnce()
})
it("does not create another subscription when removal fails", async () => {
  getSubscription.mockResolvedValue({
    ...sub,
    options: { applicationServerKey: new Uint8Array([0]).buffer },
  })
  unsubscribe.mockResolvedValue(false)
  await expect(subscribePush()).rejects.toThrow("Unsubscribe failed")
  expect(subscribe).not.toHaveBeenCalled()
})
it("uses the origin lock when available and remains usable without Web Locks", async () => {
  const action = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  await withPushLock(action)
  expect(action).toHaveBeenCalledOnce()
  const request = vi.fn<
    (name: string, action: () => Promise<void>) => Promise<void>
  >(async (_name, callback) => callback())
  vi.stubGlobal("navigator", { locks: { request } })
  await withPushLock(action)
  expect(request).toHaveBeenCalledWith("notification-device", action)
})
