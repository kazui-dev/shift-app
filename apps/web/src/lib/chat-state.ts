import * as v from "valibot"
import {
  chatAttachmentSchema,
  chatReplySchema,
} from "@workspace/shared/communications"
const fileSchema = v.object({
  id: v.string(),
  name: v.string(),
  blob: v.instance(Blob),
  dimensions: v.optional(
    v.object({
      width: v.pipe(v.number(), v.integer(), v.minValue(1)),
      height: v.pipe(v.number(), v.integer(), v.minValue(1)),
    })
  ),
  uploaded: v.optional(chatAttachmentSchema),
})
const draftSchema = v.object({
  content: v.string(),
  files: v.array(fileSchema),
  reply: v.optional(chatReplySchema),
})
const queuedSchema = v.object({
  id: v.string(),
  roomId: v.string(),
  createdAt: v.string(),
  content: v.string(),
  files: v.array(fileSchema),
  reply: v.optional(chatReplySchema),
  status: v.picklist(["waiting", "sending", "failed"]),
})
export const stateSchema = v.object({
  version: v.literal(4),
  drafts: v.record(v.string(), draftSchema),
  queue: v.array(queuedSchema),
})
export type ChatFile = v.InferOutput<typeof fileSchema>
export type ChatDraft = v.InferOutput<typeof draftSchema>
export type QueuedMessage = v.InferOutput<typeof queuedSchema>
export type SavedChat = v.InferOutput<typeof stateSchema>
