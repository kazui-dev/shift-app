import { afterEach, expect, it, vi } from "vite-plus/test"
import { syncSubscription } from "./push-subscription"
import {
  getPushConfig,
  removePushSubscription,
  savePushSubscription,
} from "@/api/push"

vi.mock("@/api/push", () => ({
  getPushConfig: vi.fn<() => Promise<{ publicKey: string }>>(async () => ({
    publicKey: "key",
  })),
  base64UrlBytes: vi.fn<() => Uint8Array>(() => new Uint8Array()),
  removePushSubscription: vi.fn<() => Promise<void>>(async () => undefined),
  savePushSubscription: vi.fn<() => Promise<void>>(async () => undefined),
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function device() {
  const notification = {
    permission: "granted",
    requestPermission: vi.fn<() => Promise<string>>(
      async (): Promise<string> => notification.permission
    ),
  }
  const subscription = {
    endpoint: "https://push.example/subscription",
    toJSON: () => ({ endpoint: "https://push.example/subscription" }),
    unsubscribe: vi.fn<() => Promise<boolean>>(async () => {
      current = null
      return true
    }),
  }
  let current: typeof subscription | null = null
  const subscribe = vi.fn<() => Promise<typeof subscription>>(async () => {
    current = subscription
    return subscription
  })
  vi.stubGlobal("Notification", notification)
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({
        active: {},
        pushManager: { getSubscription: async () => current, subscribe },
      }),
    },
  })
  return { notification, subscription, subscribe }
}

it("registers again after permission, on, block, off, permission, on", async () => {
  const { notification, subscription, subscribe } = device()
  await syncSubscription(true)
  notification.permission = "denied"
  await syncSubscription(false)
  expect(removePushSubscription).toHaveBeenCalledWith(subscription.endpoint)
  expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  notification.permission = "granted"
  await syncSubscription(true)
  expect(subscribe).toHaveBeenCalledTimes(2)
  expect(savePushSubscription).toHaveBeenCalledTimes(2)
  expect(notification.requestPermission).not.toHaveBeenCalled()
})
it("checks permission even when a subscription remains", async () => {
  const { notification } = device()
  await syncSubscription(true)
  notification.permission = "denied"
  await expect(syncSubscription(true)).rejects.toThrow(
    "通知が許可されていません"
  )
  expect(savePushSubscription).toHaveBeenCalledOnce()
  notification.permission = "granted"
  await syncSubscription(true)
  expect(savePushSubscription).toHaveBeenCalledTimes(2)
  expect(getPushConfig).toHaveBeenCalledOnce()
})
it("removes a new subscription when server registration fails so retry can register", async () => {
  const { subscription } = device()
  vi.mocked(savePushSubscription).mockRejectedValueOnce(new Error("登録失敗"))
  await expect(syncSubscription(true)).rejects.toThrow("登録失敗")
  expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  await syncSubscription(true)
  expect(savePushSubscription).toHaveBeenCalledTimes(2)
  await syncSubscription(false)
  await syncSubscription(false)
  expect(removePushSubscription).toHaveBeenCalledOnce()
})

it("requests permission before waiting for service worker or subscription lookup", async () => {
  const { notification } = device()
  notification.permission = "default"
  notification.requestPermission.mockImplementation(async () => {
    notification.permission = "granted"
    return "granted"
  })
  const registration = vi.spyOn(navigator.serviceWorker, "getRegistration")
  const sync = syncSubscription(true)
  expect(notification.requestPermission).toHaveBeenCalledOnce()
  expect(registration).not.toHaveBeenCalled()
  await sync
  expect(registration).toHaveBeenCalledOnce()
  expect(savePushSubscription).toHaveBeenCalledOnce()
})
