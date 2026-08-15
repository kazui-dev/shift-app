import { z } from "zod"

import { instantSchema, operatingYearSchema } from "./shifts"

export const createAnnouncementInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  priority: z.enum(["normal", "important"]).default("normal"),
  expiresAt: instantSchema.nullable().default(null),
})

export const announcementResponseSchema = z.object({
  id: z.string().uuid(),
  year: operatingYearSchema,
  title: z.string(),
  body: z.string(),
  priority: z.enum(["normal", "important"]),
  publishedAt: instantSchema,
  expiresAt: instantSchema.nullable(),
  authorDisplayName: z.string(),
})

export const announcementEnvelopeSchema = z.object({
  announcement: announcementResponseSchema,
})

export const announcementsResponseSchema = z.object({
  announcements: z.array(announcementResponseSchema),
})

export const chatTargetSchema = z.object({
  targetType: z.enum(["member", "role", "activity"]),
  targetId: z.string().uuid(),
})

export const createChatRoomInputSchema = z.object({
  year: operatingYearSchema,
  name: z.string().trim().min(1).max(120),
  targets: z.array(chatTargetSchema).min(1).max(100),
})

export const sendChatMessageInputSchema = z.object({
  id: z.string().uuid(),
  content: z.string().trim().min(1).max(2000),
})

export const chatRoomResponseSchema = z.object({
  id: z.string().uuid(),
  year: operatingYearSchema,
  name: z.string(),
  createdBy: z.string().uuid(),
  createdAt: instantSchema,
  updatedAt: instantSchema,
})

export const chatRoomsResponseSchema = z.object({
  rooms: z.array(chatRoomResponseSchema),
})

export const chatRoomEnvelopeSchema = z.object({
  room: chatRoomResponseSchema,
})

export const chatMessageResponseSchema = z.object({
  sequence: z.number().int().positive(),
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  memberDisplayName: z.string(),
  content: z.string(),
  createdAt: instantSchema,
})

export const chatMessagesResponseSchema = z.object({
  messages: z.array(chatMessageResponseSchema),
  hasMore: z.boolean(),
})

export const chatMessageEnvelopeSchema = z.object({
  message: chatMessageResponseSchema,
})

export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    message: chatMessageResponseSchema,
  }),
])

export const pushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().int().positive().nullable(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
})

export const deletePushSubscriptionInputSchema = z.object({
  endpoint: z.string().url().max(4096),
})

export const pushConfigResponseSchema = z.object({
  publicKey: z.string().min(1),
})
