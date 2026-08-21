import * as v from "valibot"

import { instantSchema, operatingYearSchema } from "./shifts"

export const createAnnouncementInputSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  body: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(5000)),
  priority: v.optional(v.picklist(["normal", "important"]), "normal"),
  expiresAt: v.optional(v.nullable(instantSchema), null),
})

export const announcementResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  year: operatingYearSchema,
  title: v.string(),
  body: v.string(),
  priority: v.picklist(["normal", "important"]),
  publishedAt: instantSchema,
  expiresAt: v.nullable(instantSchema),
  authorDisplayName: v.string(),
})

export const announcementEnvelopeSchema = v.object({
  announcement: announcementResponseSchema,
})

export const announcementsResponseSchema = v.object({
  announcements: v.array(announcementResponseSchema),
})

export const chatTargetSchema = v.object({
  targetType: v.picklist(["member", "role", "activity"]),
  targetId: v.pipe(v.string(), v.uuid()),
})

export const chatTargetOptionSchema = v.strictObject({
  targetType: v.literal("member"),
  targetId: v.pipe(v.string(), v.uuid()),
  displayName: v.string(),
})

export const chatTargetsResponseSchema = v.object({
  targets: v.array(chatTargetOptionSchema),
})

export const createChatRoomInputSchema = v.object({
  year: operatingYearSchema,
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  targets: v.pipe(v.array(chatTargetSchema), v.minLength(1), v.maxLength(100)),
})

export const sendChatMessageInputSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  content: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2000)),
})

export const chatRoomResponseSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  year: operatingYearSchema,
  name: v.string(),
  createdBy: v.pipe(v.string(), v.uuid()),
  createdAt: instantSchema,
  updatedAt: instantSchema,
})

export const chatRoomsResponseSchema = v.object({
  rooms: v.array(chatRoomResponseSchema),
})

export const chatRoomEnvelopeSchema = v.object({
  room: chatRoomResponseSchema,
})

export const chatMessageResponseSchema = v.object({
  sequence: v.pipe(v.number(), v.integer(), v.gtValue(0)),
  id: v.pipe(v.string(), v.uuid()),
  memberId: v.pipe(v.string(), v.uuid()),
  memberDisplayName: v.string(),
  content: v.string(),
  createdAt: instantSchema,
})

export const chatMessagesResponseSchema = v.object({
  messages: v.array(chatMessageResponseSchema),
  hasMore: v.boolean(),
})

export const chatMessageEnvelopeSchema = v.object({
  message: chatMessageResponseSchema,
})

export const chatEventSchema = v.variant("type", [
  v.object({
    type: v.literal("message"),
    message: chatMessageResponseSchema,
  }),
])

export const pushSubscriptionInputSchema = v.object({
  endpoint: v.pipe(v.string(), v.url(), v.maxLength(4096)),
  expirationTime: v.nullable(v.pipe(v.number(), v.integer(), v.gtValue(0))),
  keys: v.object({
    p256dh: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
    auth: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  }),
})

export const deletePushSubscriptionInputSchema = v.object({
  endpoint: v.pipe(v.string(), v.url(), v.maxLength(4096)),
})

export const pushConfigResponseSchema = v.object({
  publicKey: v.pipe(v.string(), v.minLength(1)),
})

export type ChatTargetOption = v.InferOutput<typeof chatTargetOptionSchema>
