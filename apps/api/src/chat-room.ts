import { DurableObject } from "cloudflare:workers"

export type ChatMessage = {
  sequence: number
  id: string
  memberId: string
  memberDisplayName: string
  content: string
  createdAt: string
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
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
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
                created_at AS createdAt
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

  sendMessage(input: {
    id: string
    memberId: string
    memberDisplayName: string
    content: string
    createdAt: number
  }): ChatMessage {
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
      return this.toMessage(existing)
    }
    const row = this.ctx.storage.sql
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
    const message = this.toMessage(row)
    const payload = JSON.stringify({ type: "message", message })
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        socket.close(1011, "Message delivery failed")
      }
    }
    return message
  }

  fetch(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.serializeAttachment({
      memberId: request.headers.get("X-Chat-Member-Id"),
    })
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") {
      socket.send("pong")
    }
  }

  webSocketError(socket: WebSocket) {
    socket.close(1011, "WebSocket error")
  }

  private toMessage(row: StoredMessage): ChatMessage {
    return {
      ...row,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }
}
