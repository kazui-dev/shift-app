import type { ChatAttachment } from "@workspace/shared/communications"

type AttachmentRow = ChatAttachment & {
  objectKey: string
  memberId: string
  messageId: string | null
  ready: number
  createdAt: number
}
const selection =
  "SELECT id,width,height,bytes,object_key AS objectKey,member_id AS memberId,message_id AS messageId,ready,created_at AS createdAt FROM attachments"
const expiry = 24 * 60 * 60 * 1000

export class ChatAttachments {
  constructor(
    private storage: DurableObjectStorage,
    private bucket: R2Bucket
  ) {}
  migrate() {
    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,object_key TEXT NOT NULL,member_id TEXT NOT NULL,
      message_id TEXT REFERENCES messages(id),ready INTEGER NOT NULL DEFAULT 0,
      width INTEGER NOT NULL DEFAULT 0,height INTEGER NOT NULL DEFAULT 0,
      bytes INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS attachments_message ON attachments(message_id);
      CREATE TABLE IF NOT EXISTS image_upload_limits (member_id TEXT PRIMARY KEY,started_at INTEGER NOT NULL,count INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS attachments_expiry ON attachments(created_at) WHERE message_id IS NULL;`)
  }
  async reserve(roomId: string, memberId: string) {
    const now = Date.now()
    // A pending reservation also counts against the limit during conversion.
    const rate = this.storage.sql
      .exec<{ count: number }>(
        `INSERT INTO image_upload_limits(member_id,started_at,count) VALUES(?,?,1)
       ON CONFLICT(member_id) DO UPDATE SET
       started_at=CASE WHEN started_at<=? THEN excluded.started_at ELSE started_at END,
       count=CASE WHEN started_at<=? THEN 1 ELSE count+1 END
       WHERE count<100 OR started_at<=? RETURNING count`,
        memberId,
        now,
        now - expiry,
        now - expiry,
        now - expiry
      )
      .toArray()[0]
    if (!rate) return null
    const id = crypto.randomUUID(),
      objectKey = `${roomId}/${id}.webp`
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
  finish(id: string, memberId: string, image: Omit<ChatAttachment, "id">) {
    return (
      this.storage.sql
        .exec(
          "UPDATE attachments SET ready=1,width=?,height=?,bytes=? WHERE id=? AND member_id=? AND ready=0 AND message_id IS NULL RETURNING id",
          image.width,
          image.height,
          image.bytes,
          id,
          memberId
        )
        .toArray().length === 1
    )
  }
  claim(ids: string[], memberId: string, messageId: string) {
    if (new Set(ids).size !== ids.length)
      throw new Error("INVALID_CHAT_ATTACHMENTS")
    for (const id of ids) {
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
        "UPDATE attachments SET message_id=? WHERE id=?",
        messageId,
        id
      )
    }
  }
  forMessage(messageId: string): ChatAttachment[] {
    return this.storage.sql
      .exec<ChatAttachment>(
        "SELECT id,width,height,bytes FROM attachments WHERE message_id=? AND ready=1 ORDER BY rowid",
        messageId
      )
      .toArray()
  }
  deleteMessage(messageId: string) {
    this.storage.sql.exec(
      "UPDATE attachments SET ready=-1 WHERE message_id=?",
      messageId
    )
  }
  readable(id: string, beforeTime: number | null) {
    return (
      this.storage.sql
        .exec<{ objectKey: string }>(
          `SELECT a.object_key AS objectKey FROM attachments a JOIN messages m ON m.id=a.message_id WHERE a.id=? AND a.ready=1 AND (? IS NULL OR m.created_at<=?)`,
          id,
          beforeTime,
          beforeTime
        )
        .toArray()[0] ?? null
    )
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
    this.storage.sql.exec("DELETE FROM attachments WHERE id=? AND ready=-1", id)
    return true
  }
  async clean(all = false) {
    // Mark before external I/O so a concurrent send cannot claim a deleted image.
    const rows = this.storage.sql
      .exec<{ id: string; objectKey: string }>(
        `UPDATE attachments SET ready=-1 WHERE ${all ? "1=1" : "ready=-1 OR (message_id IS NULL AND created_at<?)"} RETURNING id,object_key AS objectKey`,
        ...(all ? [] : [Date.now() - expiry])
      )
      .toArray()
    await Promise.all(
      rows.map(async (row) => {
        await this.bucket.delete(row.objectKey)
        this.storage.sql.exec(
          "DELETE FROM attachments WHERE id=? AND ready=-1",
          row.id
        )
      })
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
