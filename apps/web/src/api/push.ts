import {
  notificationDevicesSchema,
  pushConfigResponseSchema,
  type PushSubscriptionInput,
} from "@workspace/shared/communications"
import { apiJson, apiVoid } from "./client"
const url = "/api/me/notification-devices"
export const getPushConfig = () =>
  apiJson("/api/push/config", pushConfigResponseSchema)
export const getNotificationDevices = () =>
  apiJson(url, notificationDevicesSchema)
export const saveNotificationPreference = (id: string, enabled: boolean) =>
  apiVoid(`${url}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  })
export const saveDeviceSubscription = (
  id: string,
  subscription: PushSubscriptionInput
) =>
  apiVoid(`${url}/${id}/subscription`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  })
export function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}
