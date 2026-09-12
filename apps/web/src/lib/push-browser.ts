import * as v from "valibot"
import { pushSubscriptionInputSchema } from "@workspace/shared/communications"
import { base64UrlBytes, getPushConfig } from "@/api/push"

export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}
export async function readPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}
export async function subscribePush() {
  const [registration, config] = await Promise.all([
    navigator.serviceWorker.ready,
    getPushConfig(),
  ])
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlBytes(config.publicKey),
  })
  return v.parse(pushSubscriptionInputSchema, {
    ...subscription.toJSON(),
    expirationTime: subscription.expirationTime,
  })
}
