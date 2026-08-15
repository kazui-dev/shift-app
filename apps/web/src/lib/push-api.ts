import { pushConfigResponseSchema } from "@workspace/shared/communications"
import { z } from "zod"

import { apiJson, apiVoid } from "./api"

const okSchema = z.object({ ok: z.literal(true) })

export const getPushConfig = () =>
  apiJson("/api/push/config", pushConfigResponseSchema)

export const savePushSubscription = (subscription: PushSubscriptionJSON) =>
  apiJson("/api/push/subscriptions", okSchema, {
    method: "POST",
    body: JSON.stringify(subscription),
  })

export const removePushSubscription = (endpoint: string) =>
  apiVoid("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  })

export function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
