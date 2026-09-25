import * as v from "valibot"
import {
  linkPreviewSchema,
  type ChatAttachment,
  type LinkPreview,
} from "@workspace/shared/communications"
import type { ChatAttachments } from "./chat-attachments"
import type { Reader } from "../services/private-messages"

export type ChatMessage = {
  sequence: number
  id: string
  bot?: true
  privateTo?: { memberId: string; displayName: string }
  memberId: string
  memberDisplayName: string
  content: string
  createdAt: string
  reply?: {
    id: string
    bot?: true
    memberId: string
    sequence: number
    memberDisplayName: string
    content: string
    deleted?: boolean
  }
  editedAt?: string
  deleted?: boolean
  attachments: ChatAttachment[]
  linkPreview: LinkPreview | null
  version: number
}

type StoredMessage = {
  sequence: number
  id: string
  bot: number
  privateTo: string | null
  privateName: string | null
  memberId: string
  memberDisplayName: string
  content: string
  createdAt: number
  replyToId: string | null
  editedAt: number | null
  deleted: number
  linkPreview: string | null
  version: number
}

const messageColumns = `sequence,id,bot,private_to AS privateTo,private_name AS privateName,member_id AS memberId,member_display_name AS memberDisplayName,
  content,created_at AS createdAt,reply_to_id AS replyToId,edited_at AS editedAt,deleted,
  link_preview AS linkPreview,version`

const readable = "(private_to IS NULL OR private_to=? OR ?=1)"
const readableParams = (reader: Reader) =>
  [reader.memberId, reader.readsPrivate ? 1 : 0] as const

function storedPreview(value: string | null) {
  if (value === null) return null
  const parsed = v.safeParse(linkPreviewSchema, JSON.parse(value))
  return parsed.success ? parsed.output : null
}

/** Owns the room's message table and the JSON projection returned to clients. */
export class ChatMessages {
  constructor(
    private storage: DurableObjectStorage,
    private attachments: ChatAttachments
  ) {}

  clear() {
    this.storage.sql.exec("DELETE FROM messages")
  }

  find(id: string) {
    return this.storage.sql
      .exec<StoredMessage>(
        `SELECT ${messageColumns} FROM messages WHERE id=?`,
        id
      )
      .toArray()[0]
  }

  canRead(row: StoredMessage, reader: Reader) {
    return (
      row.privateTo === null ||
      row.privateTo === reader.memberId ||
      reader.readsPrivate
    )
  }

  delete(id: string) {
    this.storage.sql.exec(
      "UPDATE messages SET content='',deleted=1,version=version+1 WHERE id=?",
      id
    )
  }

  edit(id: string, content: string, at: number) {
    this.storage.sql.exec(
      "UPDATE messages SET content=?,edited_at=?,version=version+1 WHERE id=?",
      content,
      at,
      id
    )
  }

  advanceVersion(id: string) {
    this.storage.sql.exec(
      "UPDATE messages SET version=version+1 WHERE id=?",
      id
    )
  }

  insert(input: {
    id: string
    memberId: string
    memberDisplayName: string
    content: string
    createdAt: number
    replyToId?: string
    privateTo: string | null
    privateName: string | null
  }) {
    return this.storage.sql
      .exec<StoredMessage>(
        `INSERT INTO messages
          (id, member_id, member_display_name, content, created_at, reply_to_id, private_to, private_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING ${messageColumns}`,
        input.id,
        input.memberId,
        input.memberDisplayName,
        input.content,
        input.createdAt,
        input.replyToId ?? null,
        input.privateTo,
        input.privateName
      )
      .one()
  }

  postBot(input: {
    id: string
    botId: string
    botName: string
    content: string
    createdAt: number
    privateTo: { memberId: string; displayName: string } | null
  }): ChatMessage {
    const existing = this.find(input.id)
    if (existing) return this.toMessage(existing)
    const row = this.storage.sql
      .exec<StoredMessage>(
        `INSERT INTO messages
        (id, bot, member_id, member_display_name, content, created_at, private_to, private_name)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?)
        RETURNING ${messageColumns}`,
        input.id,
        input.botId,
        input.botName,
        input.content,
        input.createdAt,
        input.privateTo?.memberId ?? null,
        input.privateTo?.displayName ?? null
      )
      .one()
    return this.toMessage(row)
  }

  get(beforeSequence: number | null, limit: number, reader: Reader) {
    const boundedLimit = Math.max(1, Math.min(limit, 100))
    const rows = this.storage.sql
      .exec<StoredMessage>(
        `SELECT ${messageColumns}
         FROM messages
         WHERE (? IS NULL OR sequence < ?) AND ${readable}
         ORDER BY sequence DESC
         LIMIT ?`,
        beforeSequence,
        beforeSequence,
        ...readableParams(reader),
        boundedLimit
      )
      .toArray()
    const oldest = rows.at(-1)?.sequence
    const older =
      oldest === undefined
        ? []
        : this.storage.sql
            .exec<{ sequence: number }>(
              `SELECT sequence FROM messages WHERE sequence < ? AND deleted = 0 AND ${readable} LIMIT 1`,
              oldest,
              ...readableParams(reader)
            )
            .toArray()
    return {
      messages: this.toMessages(rows.reverse()),
      hasMore: older.length > 0,
    }
  }

  search(query: string, before: number | null, limit: number, reader: Reader) {
    const size = Math.max(1, Math.min(limit, 100))
    const rows = this.storage.sql
      .exec<StoredMessage>(
        `SELECT ${messageColumns}
       FROM messages WHERE deleted=0 AND instr(lower(content),lower(?))>0
       AND (? IS NULL OR sequence<?) AND ${readable} ORDER BY sequence DESC LIMIT ?`,
        query,
        before,
        before,
        ...readableParams(reader),
        size + 1
      )
      .toArray()
    return {
      messages: this.toMessages(rows.slice(0, size)),
      hasMore: rows.length > size,
    }
  }

  linkPreview(id: string, reader: Reader) {
    const row = this.find(id)
    return row && !row.deleted && this.canRead(row, reader)
      ? storedPreview(row.linkPreview)
      : null
  }

  toMessage(row: StoredMessage) {
    return this.messageJson(row, this.related([row]))
  }

  private toMessages(rows: StoredMessage[]) {
    const related = this.related(rows)
    return rows.map((row) => this.messageJson(row, related))
  }

  /** The replied-to messages and attachments of a page, each in one query. */
  private related(rows: StoredMessage[]) {
    const replyIds = [
      ...new Set(rows.flatMap((row) => (row.replyToId ? [row.replyToId] : []))),
    ]
    const replies = new Map(
      (replyIds.length
        ? this.storage.sql
            .exec<StoredMessage>(
              `SELECT ${messageColumns} FROM messages WHERE id IN (SELECT value FROM json_each(?))`,
              JSON.stringify(replyIds)
            )
            .toArray()
        : []
      ).map((reply) => [reply.id, reply])
    )
    return {
      replies,
      attachments: this.attachments.forMessages(rows.map((row) => row.id)),
    }
  }

  private messageJson(
    row: StoredMessage,
    related: ReturnType<ChatMessages["related"]>
  ): ChatMessage {
    const target = row.replyToId
      ? related.replies.get(row.replyToId)
      : undefined
    return {
      sequence: row.sequence,
      id: row.id,
      ...(row.bot ? { bot: true as const } : {}),
      ...(row.privateTo === null
        ? {}
        : {
            privateTo: {
              memberId: row.privateTo,
              displayName: row.privateName ?? "",
            },
          }),
      memberId: row.memberId,
      memberDisplayName: row.memberDisplayName,
      content: row.content,
      createdAt: new Date(row.createdAt).toISOString(),
      ...(row.editedAt === null
        ? {}
        : { editedAt: new Date(row.editedAt).toISOString() }),
      ...(row.deleted ? { deleted: true } : {}),
      ...(target
        ? {
            reply: {
              id: target.id,
              ...(target.bot ? { bot: true as const } : {}),
              memberId: target.memberId,
              sequence: target.sequence,
              memberDisplayName: target.memberDisplayName,
              content: target.content,
              ...(target.deleted ? { deleted: true } : {}),
            },
          }
        : {}),
      attachments: related.attachments.get(row.id) ?? [],
      linkPreview: storedPreview(row.linkPreview),
      version: row.version,
    }
  }
}
