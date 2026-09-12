import {
  pushConfigResponseSchema,
  pushSubscriptionsSchema,
  type PushSubscriptionInput,
} from "@workspace/shared/communications"
import { apiJson, apiVoid } from "./client"

const url = "/api/me/push-subscriptions"
export const getPushConfig = () =>
  apiJson("/api/push/config", pushConfigResponseSchema)
export const getPushSubscriptions = () => apiJson(url, pushSubscriptionsSchema)
export const savePushSubscription = (subscription: PushSubscriptionInput) =>
  apiVoid(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  })
export const disablePushSubscription = (endpoint: string) =>
  apiVoid(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  })
export function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}
