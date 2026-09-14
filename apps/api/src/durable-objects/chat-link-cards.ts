import type { LinkPreview } from "@workspace/shared/communications"
import { messageLinks } from "@workspace/shared/messages"

/**
 * How long a failed card waits before each retry: past the few minutes the
 * shared cache remembers the failure, then once more much later.
 */
const retries = [6 * 60_000, 30 * 60_000]

/** The link a message's card shows: the first one in its content. */
export const cardLink = (content: string) =>
  messageLinks(content).find((part) => part.href)?.href ?? null

type Job = { messageId: string; roomId: string; url: string; attempts: number }

/**
 * Link cards, made after a message is stored so sending never waits on another
 * site. A card is stored whole, with an image only when one could be made, so
 * the history never changes a card's shape after showing it.
 */
export class ChatLinkCards {
  constructor(
    private storage: DurableObjectStorage,
    private make: (url: string) => Promise<LinkPreview | null>
  ) {}

  createTables() {
    this.storage.sql.exec(`CREATE TABLE link_cards (
      message_id TEXT PRIMARY KEY REFERENCES messages(id),
      room_id TEXT NOT NULL,
      url TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER NOT NULL
    );
    CREATE INDEX link_cards_due ON link_cards(due_at);`)
  }

  /**
   * Starts a message's card over for its link: any card it had is gone until
   * the new one is made. Returns when that is due, or `null` without a link.
   */
  request(roomId: string, messageId: string, url: string | null, now: number) {
    this.storage.sql.exec(
      "UPDATE messages SET link_preview=NULL WHERE id=?",
      messageId
    )
    this.storage.sql.exec(
      "DELETE FROM link_cards WHERE message_id=?",
      messageId
    )
    if (!url) return null
    this.storage.sql.exec(
      "INSERT INTO link_cards(message_id,room_id,url,due_at) VALUES(?,?,?,?)",
      messageId,
      roomId,
      url,
      now
    )
    return now
  }

  /** Makes the cards that are due, returning those now stored and when the next is due. */
  async run(now: number) {
    const due = this.storage.sql
      .exec<Job>(
        "SELECT message_id AS messageId,room_id AS roomId,url,attempts FROM link_cards WHERE due_at<=?",
        now
      )
      .toArray()
    const made = await Promise.all(
      due.map(async (job) => ({
        job,
        card: await this.make(job.url).catch(() => null),
      }))
    )
    const stored: Job[] = []
    for (const { job, card } of made) {
      // An edit or deletion while the card was made replaced or removed the job.
      const current = this.storage.sql
        .exec(
          "SELECT 1 FROM link_cards WHERE message_id=? AND url=? AND attempts=?",
          job.messageId,
          job.url,
          job.attempts
        )
        .toArray()
      if (!current.length) continue
      const wait = retries[job.attempts]
      if (card || wait === undefined) {
        if (card)
          this.storage.sql.exec(
            "UPDATE messages SET link_preview=?,version=version+1 WHERE id=?",
            JSON.stringify(card),
            job.messageId
          )
        this.storage.sql.exec(
          "DELETE FROM link_cards WHERE message_id=?",
          job.messageId
        )
        if (card) stored.push(job)
      } else
        this.storage.sql.exec(
          "UPDATE link_cards SET attempts=attempts+1,due_at=? WHERE message_id=?",
          now + wait,
          job.messageId
        )
    }
    const next = this.storage.sql
      .exec<{ at: number | null }>("SELECT MIN(due_at) AS at FROM link_cards")
      .one().at
    return { stored, next }
  }

  /** Forgets every pending card, before a deleted room's messages go. */
  clear() {
    this.storage.sql.exec("DELETE FROM link_cards")
  }
}
