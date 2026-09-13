import type * as v from "valibot"
import type { chatMessageResponseSchema } from "@workspace/shared/communications"
import { japanDateWeekday } from "@workspace/shared/japan-time"
import type { ChatFile, QueuedMessage } from "@/lib/chat/store"

type Message = v.InferOutput<typeof chatMessageResponseSchema>
export type MessageRow = Omit<Message, "sequence"> & {
  sequence: number | null
  files: ChatFile[]
  status: QueuedMessage["status"] | "sent"
}
export function messageRows(
  messages: Message[],
  queue: QueuedMessage[],
  member: { id: string; displayName: string; image: string | null },
  retained?: MessageRow | null
): MessageRow[] {
  const ids = new Set(messages.map((message) => message.id))
  return [
    ...messages
      .filter((message) => !message.deleted || message.id === retained?.id)
      .map((message) =>
        message.id === retained?.id
          ? retained
          : {
              ...message,
              files: [],
              status: "sent" as const,
            }
      ),
    ...queue
      .filter((message) => !ids.has(message.id))
      .map((message) => ({
        id: message.id,
        sequence: null,
        memberId: member.id,
        memberDisplayName: member.displayName,
        memberImage: member.image,
        content: message.content,
        reply: message.reply,
        createdAt: message.createdAt,
        attachments: [],
        files: message.files,
        status: message.status,
      })),
  ]
}

export function unreadMessage(rows: MessageRow[], lastRead: number) {
  return lastRead > 0
    ? rows.find(
        (message) => message.sequence !== null && message.sequence > lastRead
      )
    : undefined
}

/** Consecutive messages from one member within five minutes read as one block. */
export function groupedWithPrevious(
  message: MessageRow,
  previous: MessageRow | undefined,
  unread: boolean
) {
  const newDay =
    !previous ||
    japanDateWeekday(previous.createdAt) !== japanDateWeekday(message.createdAt)
  return {
    newDay,
    grouped:
      !!previous &&
      previous.memberId === message.memberId &&
      !newDay &&
      !unread &&
      !message.reply &&
      !message.deleted &&
      !previous.deleted &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 300_000,
  }
}
