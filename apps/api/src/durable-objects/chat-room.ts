import * as v from "valibot"
import { messagePermissions } from "@workspace/shared/messages"
import { findAccessibleRoom } from "../services/chat-access"
import {
  linkPreviewSchema,
  type ChatAttachment,
  type LinkPreview,
} from "@workspace/shared/communications"
import { purgeShared } from "../lib/shared-cache"
import { publishChatEvent } from "../services/chat-directory"
import { withMemberImages } from "../services/chat-profiles"
import { makeLinkCard } from "../services/link-card"
import { ChatAttachments, type StoredAttachment } from "./chat-attachments"
import { cardLink, ChatLinkCards } from "./chat-link-cards"
import { DurableObject } from "cloudflare:workers"

type ChatMessage = {
  sequence: number
  id: string
  memberId: string
  memberDisplayName: string
  content: string
  createdAt: string
  reply?: {
    id: string
    memberId: string
    sequence: number
    memberDisplayName: string
    content: string
    deleted?: boolean
  }
  editedAt?: string
  deleted?: boolean
  attachments: ChatAttachment[]
  /** The first link's card once it is made, or `null`. */
  linkPreview: LinkPreview | null
  /** Rises with every change, so an older copy never replaces a newer one. */
  version: number
}

type StoredMessage = {
  sequence: number
  id: string
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

/** Every column of a stored message, named as `StoredMessage`. */
const messageColumns = `sequence,id,member_id AS memberId,member_display_name AS memberDisplayName,
  content,created_at AS createdAt,reply_to_id AS replyToId,edited_at AS editedAt,deleted,
  link_preview AS linkPreview,version`

function storedPreview(value: string | null) {
  if (value === null) return null
  const parsed = v.safeParse(linkPreviewSchema, JSON.parse(value))
  return parsed.success ? parsed.output : null
}

export class ChatRoom extends DurableObject<CloudflareBindings> {
  private deleted = false
  private attachments: ChatAttachments
  private cards: ChatLinkCards

  async deleteMessages(roomId: string) {
    const room = await this.env.shift_app
      .prepare("SELECT id FROM chat_rooms WHERE id=?")
      .bind(roomId)
      .first()
    if (room) throw new Error("Cannot delete an existing room")
    this.deleted = true
    for (const socket of this.ctx.getWebSockets())
      socket.close(1000, "Room deleted")
    await this.attachments.clean(true)
    this.cards.clear()
    this.ctx.storage.sql.exec("DELETE FROM messages")
  }
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
    this.attachments = new ChatAttachments(
      ctx.storage,
      env.CHAT_IMAGES,
      purgeShared
    )
    this.cards = new ChatLinkCards(ctx.storage, makeLinkCard)
    void ctx.blockConcurrencyWhile(() => Promise.resolve(this.migrate()))
  }

  /** Applies each schema version once, in order, each in its own transaction. */
  private migrate() {
    const { sql } = this.ctx.storage
    const versions = [
      () =>
        sql.exec(`CREATE TABLE messages (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE,
          member_id TEXT NOT NULL,
          member_display_name TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX messages_created_at_idx ON messages(created_at);`),
      () => this.attachments.createTables(),
      () =>
        sql.exec(`ALTER TABLE messages ADD COLUMN reply_to_id TEXT REFERENCES messages(id);
        ALTER TABLE messages ADD COLUMN edited_at INTEGER;
        ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;`),
      () => this.attachments.storeOriginals(),
      () => this.attachments.keepSentOrder(),
      // A message keeps its first link's card, so the card is known before it renders.
      () => sql.exec("ALTER TABLE messages ADD COLUMN link_preview TEXT;"),
      () => this.cards.createTables(),
      // Every change raises a message's version, so clients keep its newest copy.
      () =>
        sql.exec(
          "ALTER TABLE messages ADD COLUMN version INTEGER NOT NULL DEFAULT 1;"
        ),
      () => this.attachments.countReservations(),
    ]
    sql.exec(`CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`)
    const applied = sql
      .exec<{ version: number }>(
        "SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations"
      )
      .one().version
    versions.forEach((apply, index) => {
      if (index < applied) return
      this.ctx.storage.transactionSync(() => {
        apply()
        sql.exec("INSERT INTO _sql_schema_migrations(id) VALUES(?)", index + 1)
      })
    })
  }

  private findMessage(id: string) {
    return this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT ${messageColumns} FROM messages WHERE id=?`,
        id
      )
      .toArray()[0]
  }

  async changeMessage(input: {
    roomId: string
    memberId: string
    id: string
    content?: string
  }) {
    const room = await findAccessibleRoom(
      this.env,
      input.roomId,
      input.memberId
    )
    if (this.deleted || !room) return { error: "not_found" } as const
    const row = this.findMessage(input.id)
    if (!row) return { error: "not_found" } as const
    const deleting = input.content === undefined
    const permission = messagePermissions({
      memberId: input.memberId,
      authorId: row.memberId,
      canPost: room.canPost === 1,
      canManage: room.canManage === 1,
      deleted: !deleting && row.deleted === 1,
    })
    if (!(deleting ? permission.delete : permission.edit))
      return { error: "forbidden" } as const
    if (deleting && row.deleted)
      return { message: this.toMessage(row), changed: false }
    if (
      !deleting &&
      !input.content?.trim() &&
      !this.attachments.forMessages([row.id]).has(row.id)
    )
      return { error: "empty" } as const
    if (!deleting && input.content === row.content)
      return { message: this.toMessage(row), changed: false }
    if (deleting) await this.ctx.storage.setAlarm(Date.now() + 1000)
    const now = Date.now()
    const due = this.ctx.storage.transactionSync(() => {
      if (deleting) {
        this.ctx.storage.sql.exec(
          "UPDATE messages SET content='',deleted=1,version=version+1 WHERE id=?",
          row.id
        )
        this.attachments.deleteMessage(row.id)
        return this.cards.request(input.roomId, row.id, null, now)
      }
      const content = input.content ?? ""
      this.ctx.storage.sql.exec(
        "UPDATE messages SET content=?,edited_at=?,version=version+1 WHERE id=?",
        content,
        now,
        row.id
      )
      // The card stays while the first link does.
      const link = cardLink(content)
      return link === cardLink(row.content)
        ? null
        : this.cards.request(input.roomId, row.id, link, now)
    })
    if (due !== null) await this.schedule(due)
    const updated = this.findMessage(row.id)
    if (!updated) throw new Error("Message disappeared")
    return { message: this.toMessage(updated), changed: true }
  }

  async reserveAttachment(roomId: string, memberId: string, bytes: number) {
    if (this.deleted) return null
    return this.attachments.reserve(roomId, memberId, bytes)
  }
  finishAttachment(id: string, memberId: string, image: StoredAttachment) {
    return !this.deleted && this.attachments.finish(id, memberId, image)
  }
  getAttachment(id: string) {
    return this.attachments.readable(id)
  }
  deleteAttachment(id: string, memberId: string) {
    return this.attachments.remove(id, memberId)
  }
  override async alarm() {
    try {
      await this.attachments.clean()
      const { stored, next } = await this.cards.run(Date.now())
      // A card is stored whether or not its members hear of it now.
      await Promise.allSettled(
        stored.map((job) => this.publishCard(job.roomId, job.messageId))
      )
      if (next !== null) await this.schedule(next)
    } catch (error) {
      await this.ctx.storage.setAlarm(Date.now() + 300_000)
      throw error
    }
  }

  /** Sets the alarm for `at`, unless an earlier one is already set. */
  private async schedule(at: number) {
    const current = await this.ctx.storage.getAlarm()
    if (current === null || at < current) await this.ctx.storage.setAlarm(at)
  }

  /** Tells the room a message now shows its card. */
  private async publishCard(roomId: string, messageId: string) {
    const row = this.findMessage(messageId)
    if (!row) return
    const [message] = await withMemberImages(this.env, [this.toMessage(row)])
    if (message)
      await publishChatEvent(this.env, {
        type: "message_changed",
        roomId,
        message,
      })
  }

  getMessages(
    beforeSequence: number | null,
    limit: number
  ): { messages: ChatMessage[]; hasMore: boolean } {
    const boundedLimit = Math.max(1, Math.min(limit, 100))
    const rows = this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT ${messageColumns}
         FROM messages
         WHERE (? IS NULL OR sequence < ?)
         ORDER BY sequence DESC
         LIMIT ?`,
        beforeSequence,
        beforeSequence,
        boundedLimit
      )
      .toArray()
    const oldest = rows.at(-1)?.sequence
    // Deleted messages are not shown, so only visible ones make older history worth loading.
    const older =
      oldest === undefined
        ? []
        : this.ctx.storage.sql
            .exec<{ sequence: number }>(
              "SELECT sequence FROM messages WHERE sequence < ? AND deleted = 0 LIMIT 1",
              oldest
            )
            .toArray()
    return {
      messages: this.toMessages(rows.reverse()),
      hasMore: older.length > 0,
    }
  }

  searchMessages(query: string, before: number | null, limit: number) {
    const size = Math.max(1, Math.min(limit, 100))
    const rows = this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT ${messageColumns}
       FROM messages WHERE deleted=0 AND instr(lower(content),lower(?))>0
       AND (? IS NULL OR sequence<?) ORDER BY sequence DESC LIMIT ?`,
        query,
        before,
        before,
        size + 1
      )
      .toArray()
    return {
      messages: this.toMessages(rows.slice(0, size)),
      hasMore: rows.length > size,
    }
  }

  /** The stored card of a message's first link, while the message stands. */
  linkPreview(id: string) {
    const row = this.findMessage(id)
    return row && !row.deleted ? storedPreview(row.linkPreview) : null
  }

  async sendMessage(input: {
    roomId: string
    id: string
    memberId: string
    memberDisplayName: string
    content: string
    createdAt: number
    replyToId?: string
    attachmentIds: string[]
  }): Promise<ChatMessage> {
    const permission = await findAccessibleRoom(
      this.env,
      input.roomId,
      input.memberId
    )
    if (this.deleted || permission?.canPost !== 1)
      throw new Error("CHAT_READ_ONLY")
    const existing = this.findMessage(input.id)
    if (existing) {
      if (existing.memberId !== input.memberId)
        throw new Error("MESSAGE_ID_CONFLICT")
      return this.toMessage(existing)
    }
    if (input.replyToId) {
      const target = this.findMessage(input.replyToId)
      if (!target || target.deleted) throw new Error("INVALID_CHAT_REPLY")
    }
    const { row, due } = this.ctx.storage.transactionSync(() => {
      const inserted = this.ctx.storage.sql
        .exec<StoredMessage>(
          `INSERT INTO messages
          (id, member_id, member_display_name, content, created_at, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING ${messageColumns}`,
          input.id,
          input.memberId,
          input.memberDisplayName,
          input.content,
          input.createdAt,
          input.replyToId ?? null
        )
        .one()
      this.attachments.claim(input.attachmentIds, input.memberId, input.id)
      return {
        row: inserted,
        due: this.cards.request(
          input.roomId,
          input.id,
          cardLink(input.content),
          Date.now()
        ),
      }
    })
    if (due !== null) await this.schedule(due)
    return this.toMessage(row)
  }

  private toMessage(row: StoredMessage) {
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
        ? this.ctx.storage.sql
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
    related: ReturnType<ChatRoom["related"]>
  ): ChatMessage {
    const target = row.replyToId
      ? related.replies.get(row.replyToId)
      : undefined
    return {
      sequence: row.sequence,
      id: row.id,
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
