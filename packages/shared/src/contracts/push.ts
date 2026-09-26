import * as v from "valibot"

export const pushSubscriptionInputSchema = v.object({
  endpoint: v.pipe(v.string(), v.url(), v.maxLength(4096)),
  expirationTime: v.nullable(v.pipe(v.number(), v.integer(), v.gtValue(0))),
  keys: v.object({
    p256dh: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
    auth: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  }),
})

export const notificationPreferenceSchema = v.strictObject({
  enabled: v.boolean(),
})
export const notificationDevicesSchema = v.array(
  v.object({
    id: v.pipe(v.string(), v.uuid()),
    endpoint: v.nullable(v.pipe(v.string(), v.url())),
    enabled: v.boolean(),
  })
)
export type PushSubscriptionInput = v.InferOutput<
  typeof pushSubscriptionInputSchema
>

export const pushConfigResponseSchema = v.object({
  publicKey: v.pipe(v.string(), v.minLength(1)),
})
