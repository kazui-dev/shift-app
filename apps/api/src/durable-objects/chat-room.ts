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
  attachments: ChatAttachment[]
}

type StoredMessage = {
  sequence: number
  id: string
  memberId: string
  memberDisplayName: string
  content: string
  createdAt: number
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
  getAttachment(id: string, beforeTime: number | null) {
    return this.attachments.readable(id, beforeTime)
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
    limit: number,
    beforeTime: number | null
  ): { messages: ChatMessage[]; hasMore: boolean } {
    const boundedLimit = Math.max(1, Math.min(limit, 100))
    const rows = this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT sequence, id, member_id AS memberId,
                member_display_name AS memberDisplayName, content,
                created_at AS createdAt
         FROM messages
         WHERE (? IS NULL OR sequence < ?) AND (? IS NULL OR created_at <= ?)
         ORDER BY sequence DESC
         LIMIT ?`,
        beforeSequence,
        beforeSequence,
        beforeTime,
        beforeTime,
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

  async sendMessage(input: {
    roomId: string
    id: string
    memberId: string
    memberDisplayName: string
    content: string
    createdAt: number
    attachmentIds: string[]
  }): Promise<ChatMessage> {
    const permission = await this.env.shift_app
      .prepare(
        "SELECT can_post FROM chat_effective_permissions WHERE room_id=? AND member_id=?"
      )
      .bind(input.roomId, input.memberId)
      .first<{ can_post: number }>()
    if (this.deleted || permission?.can_post !== 1)
      throw new Error("Chat posting permission has changed")
    const existing = this.ctx.storage.sql
      .exec<StoredMessage>(
        `SELECT sequence, id, member_id AS memberId,
                member_display_name AS memberDisplayName, content,
                created_at AS createdAt
         FROM messages WHERE id = ?`,
        input.id
      )
      .toArray()[0]
    if (existing) {
      if (existing.memberId !== input.memberId)
        throw new Error("MESSAGE_ID_CONFLICT")
      return this.toMessage(existing)
    }
    const row = this.ctx.storage.transactionSync(() => {
      const inserted = this.ctx.storage.sql
        .exec<StoredMessage>(
          `INSERT INTO messages
          (id, member_id, member_display_name, content, created_at)
         VALUES (?, ?, ?, ?, ?)
         RETURNING sequence, id, member_id AS memberId,
                   member_display_name AS memberDisplayName, content,
                   created_at AS createdAt`,
          input.id,
          input.memberId,
          input.memberDisplayName,
          input.content,
          input.createdAt
        )
        .one()
      this.attachments.claim(input.attachmentIds, input.memberId, input.id)
      return inserted
    })
    const message = this.toMessage(row)
    const payload = JSON.stringify({ type: "message", message })
    const allowed = await this.env.shift_app
      .prepare(
        "SELECT member_id FROM chat_effective_permissions WHERE room_id=? AND can_read=1"
      )
      .bind(input.roomId)
      .all<{ member_id: string }>()
    const recipients = new Set(allowed.results.map((item) => item.member_id))
    for (const socket of this.ctx.getWebSockets()) {
      const attachment: unknown = socket.deserializeAttachment()
      if (
        typeof attachment !== "object" ||
        attachment === null ||
        !("memberId" in attachment) ||
        typeof attachment.memberId !== "string" ||
        !recipients.has(attachment.memberId)
      ) {
        socket.close(1008, "Access ended")
        continue
      }
      try {
        socket.send(payload)
      } catch {
        socket.close(1011, "Message delivery failed")
      }
    }
    return message
  }

  override fetch(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    if (!client || !server) {
      return new Response("Failed to create WebSocket pair", { status: 500 })
    }
    server.serializeAttachment({
      memberId: request.headers.get("X-Chat-Member-Id"),
      roomId: request.headers.get("X-Chat-Room-Id"),
    })
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  override webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") {
      socket.send("pong")
    }
  }

  override webSocketError(socket: WebSocket) {
    socket.close(1011, "WebSocket error")
  }

  private toMessage(row: StoredMessage): ChatMessage {
    return {
      ...row,
      createdAt: new Date(row.createdAt).toISOString(),
      attachments: this.attachments.forMessage(row.id),
    }
  }
}
