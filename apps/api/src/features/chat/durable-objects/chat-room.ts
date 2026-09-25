import { messagePermissions } from "@workspace/shared/messages"
import { findAccessibleRoom } from "../services/chat-access"
import { purgeShared } from "../../../lib/shared-cache"
import { publishChatEvent } from "../services/chat-directory"
import { withMemberImages } from "../services/chat-profiles"
import { makeLinkCard } from "../services/link-card"
import type { UploadLimit } from "../domain/chat-attachment"
import { ChatAttachments, type StoredAttachment } from "./chat-attachments"
import { cardLink, ChatLinkCards } from "./chat-link-cards"
import { ChatMessages, type ChatMessage } from "./chat-messages"
import type { Reader } from "../services/private-messages"
import { DurableObject } from "cloudflare:workers"

export class ChatRoom extends DurableObject<CloudflareBindings> {
  private deleted = false
  private attachments: ChatAttachments
  private cards: ChatLinkCards
  private messages: ChatMessages

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
    this.messages.clear()
  }
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
    this.attachments = new ChatAttachments(
      ctx.storage,
      env.CHAT_IMAGES,
      purgeShared
    )
    this.cards = new ChatLinkCards(ctx.storage, makeLinkCard)
    this.messages = new ChatMessages(ctx.storage, this.attachments)
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
      () => this.attachments.trackOriginals(),
      // A bot posts as itself, and its messages belong to no member.
      () =>
        sql.exec(
          "ALTER TABLE messages ADD COLUMN bot INTEGER NOT NULL DEFAULT 0;"
        ),
      // A message may be for one member and the shift's keepers alone.
      () =>
        sql.exec(`ALTER TABLE messages ADD COLUMN private_to TEXT;
        ALTER TABLE messages ADD COLUMN private_name TEXT;`),
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

  async changeMessage(input: {
    roomId: string
    memberId: string
    readsPrivate: boolean
    id: string
    content?: string
  }) {
    const room = await findAccessibleRoom(
      this.env,
      input.roomId,
      input.memberId
    )
    if (this.deleted || !room) return { error: "not_found" } as const
    const row = this.messages.find(input.id)
    if (!row || !this.messages.canRead(row, input))
      return { error: "not_found" } as const
    const deleting = input.content === undefined
    const permission = messagePermissions({
      memberId: input.memberId,
      authorId: row.memberId,
      bot: row.bot === 1,
      canPost: room.canPost === 1,
      canManage: room.canManage === 1,
      deleted: !deleting && row.deleted === 1,
    })
    if (!(deleting ? permission.delete : permission.edit))
      return { error: "forbidden" } as const
    if (deleting && row.deleted)
      return { message: this.messages.toMessage(row), changed: false }
    if (
      !deleting &&
      !input.content?.trim() &&
      !this.attachments.forMessages([row.id]).has(row.id)
    )
      return { error: "empty" } as const
    if (!deleting && input.content === row.content)
      return { message: this.messages.toMessage(row), changed: false }
    if (deleting) await this.ctx.storage.setAlarm(Date.now() + 1000)
    const now = Date.now()
    const due = this.ctx.storage.transactionSync(() => {
      if (deleting) {
        this.messages.delete(row.id)
        this.attachments.deleteMessage(row.id)
        return this.cards.request(input.roomId, row.id, null, now)
      }
      const content = input.content ?? ""
      this.messages.edit(row.id, content, now)
      // The card stays while the first link does.
      const link = cardLink(content)
      return link === cardLink(row.content)
        ? null
        : this.cards.request(input.roomId, row.id, link, now)
    })
    if (due !== null) await this.schedule(due)
    const updated = this.messages.find(row.id)
    if (!updated) throw new Error("Message disappeared")
    return { message: this.messages.toMessage(updated), changed: true }
  }

  async reserveAttachment(
    roomId: string,
    memberId: string,
    bytes: number,
    limit: UploadLimit,
    copy: boolean
  ) {
    if (this.deleted) return null
    return this.attachments.reserve(roomId, memberId, bytes, limit, copy)
  }
  reserveOriginal(
    id: string,
    memberId: string,
    bytes: number,
    limit: UploadLimit
  ) {
    if (this.deleted) return "missing" as const
    return this.attachments.reserveOriginal(id, memberId, bytes, limit)
  }
  /** Records an arrived original and tells the room when its message is already sent. */
  async finishOriginal(
    roomId: string,
    id: string,
    memberId: string,
    image: StoredAttachment
  ) {
    if (this.deleted) return false
    const row = this.attachments.finishOriginal(id, memberId, image)
    if (row?.messageId) await this.publishChange(roomId, row.messageId)
    return row !== null
  }
  /** Lets a display copy stand as its original and tells the room. */
  async keepCopy(roomId: string, id: string, memberId: string) {
    if (this.deleted) return false
    const row = this.attachments.keepCopy(id, memberId)
    if (row?.messageId) await this.publishChange(roomId, row.messageId)
    return row !== null
  }
  finishAttachment(id: string, memberId: string, image: StoredAttachment) {
    return !this.deleted && this.attachments.finish(id, memberId, image)
  }
  /** A sent image, if its message is one the reader may see. */
  getAttachment(id: string, reader: Reader) {
    const attachment = this.attachments.readable(id)
    if (!attachment) return null
    const row = this.messages.find(attachment.messageId)
    return row && this.messages.canRead(row, reader)
      ? { name: attachment.name, type: attachment.type }
      : null
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

  /** Raises a message's version for a change beside its own row, then tells the room. */
  private async publishChange(roomId: string, messageId: string) {
    this.messages.advanceVersion(messageId)
    await this.publishCard(roomId, messageId)
  }

  /** Tells the room a message now shows its card. */
  private async publishCard(roomId: string, messageId: string) {
    const row = this.messages.find(messageId)
    if (!row) return
    const [message] = await withMemberImages(this.env, [
      this.messages.toMessage(row),
    ])
    if (message)
      await publishChatEvent(this.env, {
        type: "message_changed",
        roomId,
        message,
      })
  }

  getMessages(beforeSequence: number | null, limit: number, reader: Reader) {
    return this.messages.get(beforeSequence, limit, reader)
  }

  searchMessages(
    query: string,
    before: number | null,
    limit: number,
    reader: Reader
  ) {
    return this.messages.search(query, before, limit, reader)
  }

  linkPreview(id: string, reader: Reader) {
    return this.messages.linkPreview(id, reader)
  }

  /** Server-only posting: bot messages have no member authorization step. */
  postBotMessage(input: {
    id: string
    botId: string
    botName: string
    content: string
    createdAt: number
    privateTo: { memberId: string; displayName: string } | null
  }): ChatMessage | null {
    return this.deleted ? null : this.messages.postBot(input)
  }

  async sendMessage(input: {
    roomId: string
    id: string
    memberId: string
    memberDisplayName: string
    readsPrivate: boolean
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
    const existing = this.messages.find(input.id)
    if (existing) {
      if (existing.memberId !== input.memberId)
        throw new Error("MESSAGE_ID_CONFLICT")
      return this.messages.toMessage(existing)
    }
    // A reply to a private message stays among the people who could read it.
    const target = input.replyToId ? this.messages.find(input.replyToId) : null
    if (
      input.replyToId &&
      (!target || target.deleted || !this.messages.canRead(target, input))
    )
      throw new Error("INVALID_CHAT_REPLY")
    const { row, due } = this.ctx.storage.transactionSync(() => {
      const inserted = this.messages.insert({
        id: input.id,
        memberId: input.memberId,
        memberDisplayName: input.memberDisplayName,
        content: input.content,
        createdAt: input.createdAt,
        ...(input.replyToId ? { replyToId: input.replyToId } : {}),
        privateTo: target?.privateTo ?? null,
        privateName: target?.privateName ?? null,
      })
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
    return this.messages.toMessage(row)
  }
}
