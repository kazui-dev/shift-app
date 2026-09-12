import {
  pushConfigResponseSchema,
  pushDeviceSchema,
  type PushDeviceUpdate,
} from "@workspace/shared/communications"
import { apiJson } from "./client"

export const getPushConfig = () =>
  apiJson("/api/push/config", pushConfigResponseSchema)
export const getPushDevice = (id: string) =>
  apiJson(`/api/me/push-devices/${id}`, pushDeviceSchema)
export const createPushDevice = (endpoint: string | null) =>
  apiJson("/api/me/push-devices", pushDeviceSchema, {
    method: "POST",
    body: JSON.stringify({ endpoint }),
  })
export const updatePushDevice = (id: string, value: PushDeviceUpdate) =>
  apiJson(`/api/me/push-devices/${id}`, pushDeviceSchema, {
    method: "PUT",
    body: JSON.stringify(value),
  })
export function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index)
  return bytes
}
