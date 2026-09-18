import { liveDirectory } from "./live-events"
import { messageAudience } from "./private-messages"
import { notifyRoomMessage } from "./push"

/** The bots the code posts as. Rows are seeded by migration, never created. */
export type BotKey = "attendance"

type Bot = { id: string; displayName: string }

/** The bot, if it belongs to the room; a bot posts nowhere else. */
async function roomBot(
  env: CloudflareBindings,
  roomId: string,
  key: BotKey
): Promise<Bot | null> {
  const row = await env.shift_app
    .prepare(
      `SELECT bot.id, bot.display_name AS displayName FROM bots bot
       JOIN chat_room_bots member ON member.bot_id = bot.id AND member.room_id = ?
       WHERE bot.key = ?`
    )
    .bind(roomId, key)
    .first<Bot>()
  return row
}

/**
 * Posts a bot's message to a room, as a member's own message would be: it
 * counts as unread and reaches every device of those who may read it. A
 * message private to `about` is read only by them and the shift's keepers,
 * leaves the room's place in other lists alone, and rings responsibles even
 * in a muted room. `about` already knows, so their devices stay quiet.
 */
export async function postBotMessage(
  env: CloudflareBindings,
  input: {
    roomId: string
    key: BotKey
    content: string
    /** The push notification's text, when it differs from the message. */
    notification: string
    about: { memberId: string; displayName: string }
    private: boolean
  }
) {
  const bot = await roomBot(env, input.roomId, input.key)
  if (!bot) return null
  const now = Date.now()
  const privateTo = input.private ? input.about : null
  const message = await env.CHAT_ROOMS.getByName(input.roomId).postBotMessage({
    id: crypto.randomUUID(),
    botId: bot.id,
    botName: bot.displayName,
    content: input.content,
    createdAt: now,
    privateTo,
  })
  if (!message) return null
  const db = env.shift_app
  await db.batch([
    db
      .prepare(
        "UPDATE chat_rooms SET updated_at = CASE WHEN ? IS NULL THEN ? ELSE updated_at END, last_sequence = MAX(last_sequence,?) WHERE id = ? AND last_sequence < ?"
      )
      .bind(
        privateTo?.memberId ?? null,
        now,
        message.sequence,
        input.roomId,
        message.sequence
      ),
    // Filed under the member it concerns, who already knows and so has no
    // unread message in it.
    db
      .prepare(
        "INSERT OR IGNORE INTO chat_message_index(room_id,sequence,member_id,private_to) VALUES(?,?,?,?)"
      )
      .bind(
        input.roomId,
        message.sequence,
        input.about.memberId,
        privateTo?.memberId ?? null
      ),
  ])
  const audience = await messageAudience(
    env,
    input.roomId,
    privateTo?.memberId ?? null,
    true
  )
  await Promise.all([
    liveDirectory(env).publish(audience.members, {
      type: "message",
      roomId: input.roomId,
      message: { ...message, memberImage: null },
    }),
    notifyRoomMessage(
      env,
      audience.devices,
      input.roomId,
      input.about.memberId,
      bot.displayName,
      input.notification
    ),
  ])
  return message
}
