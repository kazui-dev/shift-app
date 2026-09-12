import * as v from "valibot"
import { pushSubscriptionInputSchema } from "@workspace/shared/communications"
import { base64UrlBytes, getPushConfig } from "@/api/push"
import { recordPushStep } from "./push-diagnostics"
import { readNotificationPermission } from "./notification-permission"

export type BrowserPush = Awaited<ReturnType<typeof prepareBrowserPush>>
export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}
export async function prepareBrowserPush() {
  const [existing, config] = await Promise.all([
    navigator.serviceWorker.getRegistration(),
    getPushConfig(),
  ])
  const registration = existing?.active
    ? existing
    : await navigator.serviceWorker.ready
  const options = {
    userVisibleOnly: true,
    applicationServerKey: base64UrlBytes(config.publicKey),
  }
  return {
    read: async () => {
      const [permission, subscription] = await Promise.all([
        readNotificationPermission(),
        registration.pushManager.getSubscription(),
      ])
      recordPushStep(`observe-${permission}`)
      return {
        permission,
        subscription: subscription ? parseSubscription(subscription) : null,
      }
    },
    subscribe: () => {
      recordPushStep("subscribe-start")
      return registration.pushManager.subscribe(options).then(
        (value) => {
          recordPushStep("subscribe-success")
          return parseSubscription(value)
        },
        (error: unknown) => {
          recordPushStep("subscribe-failed", error)
          throw error
        }
      )
    },
    unsubscribe: async () => {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
    },
  }
}
function parseSubscription(subscription: PushSubscription) {
  return v.parse(pushSubscriptionInputSchema, {
    ...subscription.toJSON(),
    expirationTime: subscription.expirationTime,
  })
}
