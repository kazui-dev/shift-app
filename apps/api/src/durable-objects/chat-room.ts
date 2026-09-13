import { messagePermissions } from "@workspace/shared/messages"
import { findAccessibleRoom } from "../services/chat-access"
import type { ChatAttachment } from "@workspace/shared/communications"
import { ChatAttachments } from "./chat-attachments"
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
}

export class ChatRoom extends DurableObject<CloudflareBindings> {
  private deleted = false
  private attachments: ChatAttachments

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
    this.ctx.storage.sql.exec("DELETE FROM messages")
  }
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
    this.attachments = new ChatAttachments(ctx.storage, env.CHAT_IMAGES)
    void ctx.blockConcurrencyWhile(() => Promise.resolve(this.migrate()))
  }

  private migrate() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    const version = this.ctx.storage.sql
      .exec<{ version: number }>(
        "SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations"
      )
      .one().version
    if (version < 1) {
      this.ctx.storage.sql.exec(`
        CREATE TABLE messages (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE,
          member_id TEXT NOT NULL,
          member_display_name TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX messages_created_at_idx ON messages(created_at);
        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `)
    }
    if (version < 2) {
      this.ctx.storage.transactionSync(() => {
        this.attachments.migrate()
        this.ctx.storage.sql.exec(
          "INSERT INTO _sql_schema_migrations (id) VALUES (2)"
        )
      })
    }
    if (version < 3)
      this.ctx.storage.transactionSync(() => {
        this.ctx.storage.sql
          .exec(`ALTER TABLE messages ADD COLUMN reply_to_id TEXT REFERENCES messages(id);
        ALTER TABLE messages ADD COLUMN edited_at INTEGER;
        ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
        INSERT INTO _sql_schema_migrations(id) VALUES(3);`)
      })
  }

  private findMessage(id: string) {
    return this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT sequence,id,member_id AS memberId,member_display_name AS memberDisplayName,
      content,created_at AS createdAt,reply_to_id AS replyToId,edited_at AS editedAt,deleted
      FROM messages WHERE id=?`,
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
      !this.attachments.forMessage(row.id).length
    )
      return { error: "empty" } as const
    if (!deleting && input.content === row.content)
      return { message: this.toMessage(row), changed: false }
    if (deleting) await this.ctx.storage.setAlarm(Date.now() + 1000)
    this.ctx.storage.transactionSync(() => {
      if (deleting) {
        this.ctx.storage.sql.exec(
          "UPDATE messages SET content='',deleted=1 WHERE id=?",
          row.id
        )
        this.attachments.deleteMessage(row.id)
      } else
        this.ctx.storage.sql.exec(
          "UPDATE messages SET content=?,edited_at=? WHERE id=?",
          input.content ?? "",
          Date.now(),
          row.id
        )
    })
    const updated = this.findMessage(row.id)
    if (!updated) throw new Error("Message disappeared")
    return { message: this.toMessage(updated), changed: true }
  }

  async reserveAttachment(roomId: string, memberId: string) {
    if (this.deleted) return null
    return this.attachments.reserve(roomId, memberId)
  }
  finishAttachment(
    id: string,
    memberId: string,
    image: Omit<ChatAttachment, "id">
  ) {
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
    } catch (error) {
      await this.ctx.storage.setAlarm(Date.now() + 300_000)
      throw error
    }
  }

  getMessages(
    beforeSequence: number | null,
    limit: number
  ): { messages: ChatMessage[]; hasMore: boolean } {
    const boundedLimit = Math.max(1, Math.min(limit, 100))
    const rows = this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT sequence, id, member_id AS memberId,
                member_display_name AS memberDisplayName, content,
                created_at AS createdAt, reply_to_id AS replyToId, edited_at AS editedAt, deleted
         FROM messages
         WHERE (? IS NULL OR sequence < ?)
         ORDER BY sequence DESC
         LIMIT ?`,
        beforeSequence,
        beforeSequence,
        boundedLimit + 1
      )
      .toArray()
    return {
      messages: rows
        .slice(0, boundedLimit)
        .reverse()
        .map((row) => this.toMessage(row)),
      hasMore: rows.length > boundedLimit,
    }
  }

  searchMessages(query: string, before: number | null, limit: number) {
    const size = Math.max(1, Math.min(limit, 100))
    const rows = this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT sequence,id,member_id AS memberId,member_display_name AS memberDisplayName,
       content,created_at AS createdAt,reply_to_id AS replyToId,edited_at AS editedAt,deleted
       FROM messages WHERE deleted=0 AND instr(lower(content),lower(?))>0
       AND (? IS NULL OR sequence<?) ORDER BY sequence DESC LIMIT ?`,
        query,
        before,
        before,
        size + 1
      )
      .toArray()
    return {
      messages: rows.slice(0, size).map((row) => this.toMessage(row)),
      hasMore: rows.length > size,
    }
  }

  messageContent(id: string) {
    const row = this.findMessage(id)
    return row && !row.deleted ? row.content : null
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
    const existing = this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT sequence, id, member_id AS memberId,
                member_display_name AS memberDisplayName, content,
                created_at AS createdAt, reply_to_id AS replyToId, edited_at AS editedAt, deleted
         FROM messages WHERE id = ?`,
        input.id
      )
      .toArray()[0]
    if (existing) {
      if (existing.memberId !== input.memberId)
        throw new Error("MESSAGE_ID_CONFLICT")
      return this.toMessage(existing)
    }
    if (input.replyToId) {
      const target = this.findMessage(input.replyToId)
      if (!target || target.deleted) throw new Error("INVALID_CHAT_REPLY")
    }
    const row = this.ctx.storage.transactionSync(() => {
      const inserted = this.ctx.storage.sql
        .exec<StoredMessage>(
          `INSERT INTO messages
          (id, member_id, member_display_name, content, created_at, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING sequence, id, member_id AS memberId,
                   member_display_name AS memberDisplayName, content,
                   created_at AS createdAt,reply_to_id AS replyToId,edited_at AS editedAt,deleted`,
          input.id,
          input.memberId,
          input.memberDisplayName,
          input.content,
          input.createdAt,
          input.replyToId ?? null
        )
        .one()
      this.attachments.claim(input.attachmentIds, input.memberId, input.id)
      return inserted
    })
    return this.toMessage(row)
  }

  private toMessage(row: StoredMessage): ChatMessage {
    const target = row.replyToId ? this.findMessage(row.replyToId) : undefined
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
      attachments: this.attachments.forMessage(row.id),
    }
  }
}
