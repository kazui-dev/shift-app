import * as v from "valibot"
import { pushSubscriptionInputSchema } from "@workspace/shared/push"
import {
  base64UrlBytes,
  getPushConfig,
} from "@/features/notifications/api/push"

export function pushSupported(): boolean {
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}
export async function readPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/")
  return registration ? registration.pushManager.getSubscription() : null
}
export async function subscribePush() {
  const [registration, config] = await Promise.all([
    navigator.serviceWorker.getRegistration("/"),
    getPushConfig(),
  ])
  if (!registration?.active) throw new Error("Service worker is not active")
  const existing = await registration.pushManager.getSubscription()
  const key = base64UrlBytes(config.publicKey)
  const oldKey = existing?.options.applicationServerKey
  if (
    existing &&
    ((existing.expirationTime !== null &&
      existing.expirationTime <= Date.now()) ||
      (oldKey &&
        (oldKey.byteLength !== key.byteLength ||
          !new Uint8Array(oldKey).every(
            (value, index) => value === key[index]
          ))))
  ) {
    if (!(await existing.unsubscribe())) throw new Error("Unsubscribe failed")
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  })
  return v.parse(pushSubscriptionInputSchema, {
    ...subscription.toJSON(),
    expirationTime: subscription.expirationTime,
  })
}

export function withPushLock(action: () => Promise<void>): Promise<void> {
  return navigator.locks
    ? navigator.locks.request("notification-device", action)
    : action()
}
