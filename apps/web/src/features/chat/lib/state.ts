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
/** An original still to send after its display copy, kept until it arrives. */
const originalSchema = v.object({
  fileId: v.string(),
  roomId: v.string(),
  attachmentId: v.string(),
  name: v.string(),
  blob: v.instance(Blob),
})
export const stateSchema = v.object({
  version: v.literal(5),
  drafts: v.record(v.string(), draftSchema),
  queue: v.array(queuedSchema),
  originals: v.array(originalSchema),
})
export type ChatFile = v.InferOutput<typeof fileSchema>
export type ChatDraft = v.InferOutput<typeof draftSchema>
export type QueuedMessage = v.InferOutput<typeof queuedSchema>
export type SavedChat = v.InferOutput<typeof stateSchema>
/** How far an image's upload has gone, or that it stopped; absent once uploaded. */
export type UploadProgress = { sent: number; total: number } | "failed"
export type ChatStoreState = SavedChat & {
  ready: boolean
  uploads: Record<string, UploadProgress>
}
