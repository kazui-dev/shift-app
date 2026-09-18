import { Hono } from "hono"
import { expect, it, vi } from "vite-plus/test"

import { d1Binding, migrated } from "../support/sqlite"

const sent: { endpoint: string; options: { urgency?: string } }[] = []
vi.mock("web-push", () => ({
  default: {
    sendNotification: (
      subscription: { endpoint: string },
      _payload: string,
      options: { urgency?: string }
    ) => {
      sent.push({ endpoint: subscription.endpoint, options })
      return Promise.resolve()
    },
    WebPushError: class extends Error {},
  },
}))

const { notifyRoomMessage } = await import("../../src/services/push")
const { messageAudience } = await import("../../src/services/private-messages")

const app = new Hono<{ Bindings: CloudflareBindings }>()
app.post("/rooms/:roomId/messages", async (c) => {
  const roomId = c.req.param("roomId")
  const audience = await messageAudience(c.env, roomId, null)
  await notifyRoomMessage(
    c.env,
    audience.devices,
    roomId,
    "m1",
    "全体連絡",
    "こんにちは"
  )
  return c.json({ members: audience.members.toSorted() })
})

/**
 * A room the whole year can read, with devices for three members. Inserting
 * the members joins them to the default year through the schema's trigger.
 */
function room() {
  const db = migrated()
  db.exec(`INSERT INTO operating_years (year, created_at, updated_at)
      VALUES (2026,0,0);
    INSERT INTO user (id, name, email) VALUES
      ('u1','送信者','u1@example.test'),
      ('u2','受信者','u2@example.test'),
      ('u3','ミュート','u3@example.test');
    INSERT INTO app_users (id, user_id, display_name, student_id, access_level, created_at, updated_at) VALUES
      ('m1','u1','送信者','26AJ001','member',0,0),
      ('m2','u2','受信者','26AJ002','member',0,0),
      ('m3','u3','ミュート','26AJ003','member',0,0);
    INSERT INTO chat_rooms (id, year, name, created_by, created_at, updated_at, last_sequence)
      VALUES ('room',2026,'全体連絡','m1',0,0,0);
    INSERT INTO chat_room_targets (room_id, target_type, target_id, can_read, can_post, can_manage, created_at)
      VALUES ('room','year','2026',1,1,0,0);
    INSERT INTO chat_room_preferences (room_id, member_id, muted, last_read)
      VALUES ('room','m3',1,0);
    INSERT INTO notification_devices (id, member_id, enabled, endpoint, p256dh, auth, created_at, updated_at) VALUES
      ('d1','m1',1,'https://push.test/sender','k','a',0,0),
      ('d2','m2',1,'https://push.test/phone','k','a',0,0),
      ('d3','m2',1,'https://push.test/laptop','k','a',0,0),
      ('d4','m2',0,'https://push.test/disabled','k','a',0,0),
      ('d5','m3',1,'https://push.test/muted','k','a',0,0);`)
  return db
}

it("resolves the room once, notifying every device of its unmuted members and no one else", async () => {
  const db = room()
  try {
    const response = await app.request(
      "/rooms/room/messages",
      { method: "POST" },
      { shift_app: d1Binding(db) }
    )
    expect(response.status).toBe(200)
    // Live delivery reads the same pass, muted members included.
    expect(await response.json()).toEqual({ members: ["m1", "m2", "m3"] })
    expect(sent.map((item) => item.endpoint).sort()).toEqual([
      "https://push.test/laptop",
      "https://push.test/phone",
    ])
    // A held message is worthless by the time the shift starts.
    expect(sent.every((item) => item.options.urgency === "high")).toBe(true)
  } finally {
    db.close()
  }
})
