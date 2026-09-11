import type * as v from "valibot"
import type { chatMessageResponseSchema } from "@workspace/shared/communications"
import type { ChatFile, QueuedMessage } from "@/lib/chat-store"

type Message = v.InferOutput<typeof chatMessageResponseSchema>
export type MessageRow = Omit<Message, "sequence"> & {
  sequence: number | null
  files: ChatFile[]
  status: QueuedMessage["status"] | "sent"
}
export function messageRows(
  messages: Message[],
  queue: QueuedMessage[],
  member: { id: string; displayName: string; image: string | null }
): MessageRow[] {
  const ids = new Set(messages.map((message) => message.id))
  return [
    ...messages.map((message) => ({
      ...message,
      files: [],
      status: "sent" as const,
    })),
    ...queue
      .filter((message) => !ids.has(message.id))
      .map((message) => ({
        id: message.id,
        sequence: null,
        memberId: member.id,
        memberDisplayName: member.displayName,
        memberImage: member.image,
        content: message.content,
        createdAt: message.createdAt,
        attachments: [],
        files: message.files,
        status: message.status,
      })),
  ]
}
