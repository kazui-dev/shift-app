import type { ChatAttachment } from "@workspace/shared/communications"

import {
  attachmentFileName,
  chatImageKey,
  chatImageTag,
  chatRoomTag,
} from "../domain/chat-attachment"
import type { StoredImageType } from "../domain/stored-image"

type AttachmentRow = {
  id: string
  objectKey: string
  memberId: string
  messageId: string | null
  ready: number
  createdAt: number
}
/** What an upload records once its original is stored. */
export type StoredAttachment = Omit<ChatAttachment, "id"> & {
  type: StoredImageType
}
const selection =
  "SELECT id,object_key AS objectKey,member_id AS memberId,message_id AS messageId,ready,created_at AS createdAt FROM attachments"
const sent =
  "SELECT a.id,a.width,a.height,a.bytes,a.name,a.type,m.created_at AS sentAt FROM attachments a JOIN messages m ON m.id=a.message_id"
const expiry = 24 * 60 * 60 * 1000
/** What one member may upload to a room per day, counted as uploads start. */
const dailyUploads = { count: 100, bytes: 500 * 1024 * 1024 }
/** Tags per purge, kept small since the purge limits are not documented. */
const purgeBatch = 30

export class ChatAttachments {
  constructor(
    private storage: DurableObjectStorage,
    private bucket: R2Bucket,
    private purge: (tags: string[]) => Promise<unknown>
  ) {}
  /** Attachments and the daily upload limits they count against. */
  createTables() {
    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,object_key TEXT NOT NULL,member_id TEXT NOT NULL,
      message_id TEXT REFERENCES messages(id),ready INTEGER NOT NULL DEFAULT 0,
      width INTEGER NOT NULL DEFAULT 0,height INTEGER NOT NULL DEFAULT 0,
      bytes INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS attachments_message ON attachments(message_id);
      CREATE TABLE IF NOT EXISTS image_upload_limits (member_id TEXT PRIMARY KEY,started_at INTEGER NOT NULL,count INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS attachments_expiry ON attachments(created_at) WHERE message_id IS NULL;`)
  }
  /** Originals keep their name and format, and daily uploads also count bytes. */
  storeOriginals() {
    this.storage.sql
      .exec(`ALTER TABLE attachments ADD COLUMN name TEXT NOT NULL DEFAULT '';
      ALTER TABLE attachments ADD COLUMN type TEXT NOT NULL DEFAULT 'image/webp';
      ALTER TABLE image_upload_limits ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0;`)
  }
  /** Images keep the order they were sent in, whichever upload finished first. */
  keepSentOrder() {
    this.storage.sql.exec(
      "ALTER TABLE attachments ADD COLUMN position INTEGER NOT NULL DEFAULT 0;"
    )
  }
  async reserve(roomId: string, memberId: string, bytes: number) {
    const now = Date.now(),
      since = now - expiry
    // A pending reservation also counts against the limit during conversion.
    const rate = this.storage.sql
      .exec<{ count: number }>(
        `INSERT INTO image_upload_limits(member_id,started_at,count,bytes) VALUES(?,?,1,?)
       ON CONFLICT(member_id) DO UPDATE SET
       started_at=CASE WHEN started_at<=? THEN excluded.started_at ELSE started_at END,
       count=CASE WHEN started_at<=? THEN 1 ELSE count+1 END,
       bytes=CASE WHEN started_at<=? THEN excluded.bytes ELSE bytes+excluded.bytes END
       WHERE started_at<=? OR (count<? AND bytes+excluded.bytes<=?) RETURNING count`,
        memberId,
        now,
        bytes,
        since,
        since,
        since,
        since,
        dailyUploads.count,
        dailyUploads.bytes
      )
      .toArray()[0]
    if (!rate) return null
    const id = crypto.randomUUID(),
      objectKey = chatImageKey(roomId, id)
    this.storage.sql.exec(
      "INSERT INTO attachments(id,object_key,member_id,created_at) VALUES(?,?,?,?)",
      id,
      objectKey,
      memberId,
      now
    )
    const alarm = await this.storage.getAlarm()
    if (alarm === null || alarm > now + expiry)
      await this.storage.setAlarm(now + expiry)
    return { id, objectKey }
  }
  finish(id: string, memberId: string, image: StoredAttachment) {
    return (
      this.storage.sql
        .exec(
          "UPDATE attachments SET ready=1,width=?,height=?,bytes=?,name=?,type=? WHERE id=? AND member_id=? AND ready=0 AND message_id IS NULL RETURNING id",
          image.width,
          image.height,
          image.bytes,
          image.name,
          image.type,
          id,
          memberId
        )
        .toArray().length === 1
    )
  }
  claim(ids: string[], memberId: string, messageId: string) {
    if (new Set(ids).size !== ids.length)
      throw new Error("INVALID_CHAT_ATTACHMENTS")
    ids.forEach((id, position) => {
      const row = this.storage.sql
        .exec<AttachmentRow>(`${selection} WHERE id=?`, id)
        .toArray()[0]
      if (
        !row ||
        row.memberId !== memberId ||
        row.ready !== 1 ||
        row.messageId !== null ||
        row.createdAt <= Date.now() - expiry
      )
        throw new Error("INVALID_CHAT_ATTACHMENTS")
      this.storage.sql.exec(
        "UPDATE attachments SET message_id=?,position=? WHERE id=?",
        messageId,
        position,
        id
      )
    })
  }
  forMessage(messageId: string): ChatAttachment[] {
    return this.storage.sql
      .exec<StoredAttachment & { id: string; sentAt: number }>(
        `${sent} WHERE a.message_id=? AND a.ready=1 ORDER BY a.position`,
        messageId
      )
      .toArray()
      .map(({ type, sentAt, ...image }) => ({
        ...image,
        name: attachmentFileName(image.name, type, sentAt),
      }))
  }
  deleteMessage(messageId: string) {
    this.storage.sql.exec(
      "UPDATE attachments SET ready=-1 WHERE message_id=?",
      messageId
    )
  }
  /** A sent image anyone who can read the room may see, as it saves. */
  readable(id: string) {
    const row = this.storage.sql
      .exec<StoredAttachment & { sentAt: number }>(
        `${sent} WHERE a.id=? AND a.ready=1`,
        id
      )
      .toArray()[0]
    return row
      ? {
          name: attachmentFileName(row.name, row.type, row.sentAt),
          type: row.type,
        }
      : null
  }
  async remove(id: string, memberId: string) {
    const row = this.storage.sql
      .exec<{ objectKey: string }>(
        "UPDATE attachments SET ready=-1 WHERE id=? AND member_id=? AND message_id IS NULL RETURNING object_key AS objectKey",
        id,
        memberId
      )
      .toArray()[0]
    if (!row) return false
    await this.bucket.delete(row.objectKey)
    await this.purge([chatImageTag(id)])
    this.storage.sql.exec("DELETE FROM attachments WHERE id=? AND ready=-1", id)
    return true
  }
  /**
   * Deletes images of deleted messages and expired uploads, or every image
   * when the room itself is deleted, with their cached sizes.
   */
  async clean(all = false) {
    // Mark before external I/O so a concurrent send cannot claim a deleted image.
    const rows = this.storage.sql
      .exec<{ id: string; objectKey: string }>(
        `UPDATE attachments SET ready=-1 WHERE ${all ? "1=1" : "ready=-1 OR (message_id IS NULL AND created_at<?)"} RETURNING id,object_key AS objectKey`,
        ...(all ? [] : [Date.now() - expiry])
      )
      .toArray()
    await Promise.all(rows.map((row) => this.bucket.delete(row.objectKey)))
    const tags = [
      ...new Set(
        rows.map((row) =>
          all
            ? chatRoomTag(row.objectKey.slice(0, row.objectKey.indexOf("/")))
            : chatImageTag(row.id)
        )
      ),
    ]
    await Promise.all(
      Array.from({ length: Math.ceil(tags.length / purgeBatch) }, (_, batch) =>
        this.purge(tags.slice(batch * purgeBatch, (batch + 1) * purgeBatch))
      )
    )
    for (const row of rows)
      this.storage.sql.exec(
        "DELETE FROM attachments WHERE id=? AND ready=-1",
        row.id
      )
    const next = this.storage.sql
      .exec<{ at: number | null }>(
        "SELECT MIN(created_at) AS at FROM attachments WHERE message_id IS NULL"
      )
      .one().at
    if (next !== null)
      await this.storage.setAlarm(Math.max(Date.now() + 60_000, next + expiry))
  }
}
