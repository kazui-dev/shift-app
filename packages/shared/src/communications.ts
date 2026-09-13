import * as v from "valibot"

import { instantSchema, operatingYearSchema } from "./shifts"

export const chatTargetSchema = v.object({
  targetType: v.picklist([
    "member",
    "role",
    "activity",
    "year",
    "access_level",
    "permission",
    "responsible",
  ]),
  targetId: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
})

export const chatTargetOptionSchema = v.variant("targetType", [
  v.strictObject({
    targetType: v.literal("member"),
    roleIds: v.array(v.pipe(v.string(), v.uuid())),
    activityIds: v.array(v.pipe(v.string(), v.uuid())),
    image: v.nullable(v.pipe(v.string(), v.url())),
    targetId: v.pipe(v.string(), v.uuid()),
    displayName: v.string(),
  }),
  v.strictObject({
    targetType: v.literal("role"),
    targetId: v.pipe(v.string(), v.uuid()),
    displayName: v.string(),
  }),
  v.strictObject({
    targetType: v.literal("activity"),
    targetId: v.pipe(v.string(), v.uuid()),
    displayName: v.string(),
  }),
  v.strictObject({
    targetType: v.picklist([
      "year",
      "access_level",
      "permission",
      "responsible",
    ]),
    targetId: v.string(),
    displayName: v.string(),
  }),
])

export const chatTargetsResponseSchema = v.object({
  targets: v.array(chatTargetOptionSchema),
})

export const createChatRoomInputSchema = v.object({
  year: operatingYearSchema,
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  targets: v.pipe(v.array(chatTargetSchema), v.minLength(1), v.maxLength(99)),
})

export const chatImageLimits = {
  bytes: 20 * 1024 * 1024,
  count: 10,
  pixels: 50_000_000,
} as const
/** Long edges a chat image is delivered at: list tiles and the viewer. */
export const chatImageSizes = [640, 1280, 2400] as const
export type ChatImageSize = (typeof chatImageSizes)[number]
export const chatAttachmentSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  width: v.pipe(v.number(), v.integer(), v.gtValue(0)),
  height: v.pipe(v.number(), v.integer(), v.gtValue(0)),
  bytes: v.pipe(v.number(), v.integer(), v.gtValue(0)),
  /** The name the original saves as. */
  name: v.string(),
})
export type ChatAttachment = v.InferOutput<typeof chatAttachmentSchema>
export const chatAttachmentEnvelopeSchema = v.object({
  attachment: chatAttachmentSchema,
})
export const sendChatMessageInputSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.uuid()),
    content: v.pipe(v.string(), v.trim(), v.maxLength(2000)),
    replyToId: v.optional(v.pipe(v.string(), v.uuid())),
    attachmentIds: v.pipe(
      v.array(v.pipe(v.string(), v.uuid())),
      v.maxLength(chatImageLimits.count)
    ),
  }),
  v.check(
    (value) => value.content.length > 0 || value.attachmentIds.length > 0,
    "本文または画像を追加してください。"
  )
)

export const chatRoomResponseSchema = v.object({
  allowExit: v.boolean(),
  activityId: v.nullable(v.string()),
  activityStartsAt: v.nullable(instantSchema),
  activityEndsAt: v.nullable(instantSchema),
  canPost: v.boolean(),
  canManage: v.boolean(),
  muted: v.boolean(),
  lastRead: v.number(),
  lastSequence: v.number(),
  unreadCount: v.number(),
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

export const chatReplySchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  sequence: v.number(),
  memberDisplayName: v.string(),
  memberImage: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  content: v.string(),
  deleted: v.optional(v.boolean()),
})
export const editChatMessageInputSchema = v.object({
  content: v.pipe(v.string(), v.trim(), v.maxLength(2000)),
})

const storedChatMessageSchema = v.object({
  reply: v.optional(chatReplySchema),
  editedAt: v.optional(instantSchema),
  deleted: v.optional(v.boolean()),
  sequence: v.pipe(v.number(), v.integer(), v.gtValue(0)),
  id: v.pipe(v.string(), v.uuid()),
  memberId: v.pipe(v.string(), v.uuid()),
  memberDisplayName: v.string(),
  content: v.string(),
  attachments: v.array(chatAttachmentSchema),
  createdAt: instantSchema,
})

export const chatMessageResponseSchema = v.object({
  ...storedChatMessageSchema.entries,
  memberImage: v.nullable(v.pipe(v.string(), v.url())),
})

export const chatMessagesResponseSchema = v.object({
  messages: v.array(chatMessageResponseSchema),
  hasMore: v.boolean(),
})

export const chatMessageEnvelopeSchema = v.object({
  message: chatMessageResponseSchema,
})

export const chatEventSchema = v.variant("type", [
  v.object({ type: v.literal("access_changed") }),
  v.object({
    type: v.literal("room_removed"),
    roomId: v.pipe(v.string(), v.uuid()),
  }),
  v.object({
    type: v.literal("room_changed"),
    roomId: v.pipe(v.string(), v.uuid()),
  }),
  v.object({
    type: v.literal("preferences_changed"),
    roomId: v.pipe(v.string(), v.uuid()),
    lastRead: v.number(),
    muted: v.boolean(),
  }),
  v.object({
    type: v.literal("message_changed"),
    roomId: v.pipe(v.string(), v.uuid()),
    message: chatMessageResponseSchema,
  }),
  v.object({
    type: v.literal("message"),
    roomId: v.pipe(v.string(), v.uuid()),
    message: chatMessageResponseSchema,
  }),
])
export type ChatEvent = v.InferOutput<typeof chatEventSchema>

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

export type ChatTargetOption = v.InferOutput<typeof chatTargetOptionSchema>

export const chatPreferencesInputSchema = v.strictObject({
  muted: v.optional(v.boolean()),
  lastRead: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
})
export const roomSettingsInputSchema = v.strictObject({
  allowExit: v.boolean(),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  targets: v.pipe(
    v.array(
      v.object({
        ...chatTargetSchema.entries,
        canRead: v.boolean(),
        canPost: v.boolean(),
        canManage: v.boolean(),
      })
    ),
    v.maxLength(100)
  ),
})

export const roomSettingsResponseSchema = v.object({
  ...roomSettingsInputSchema.entries,
})

export const chatMembersResponseSchema = v.object({
  members: v.array(
    v.object({
      id: v.string(),
      displayName: v.string(),
      canManage: v.boolean(),
      image: v.nullable(v.pipe(v.string(), v.url())),
    })
  ),
})

export const chatLinkPreviewSchema = v.object({
  preview: v.nullable(
    v.object({
      url: v.pipe(v.string(), v.url()),
      title: v.string(),
      description: v.string(),
      site: v.string(),
      image: v.nullable(v.pipe(v.string(), v.url())),
    })
  ),
})
