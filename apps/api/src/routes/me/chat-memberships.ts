import { Hono } from "hono"
import { apiError, type ApiEnv } from "../../lib/http"
import { findAccessibleRoom } from "../../services/chat-access"
export const chatMembershipsApp = new Hono<ApiEnv>()
chatMembershipsApp.delete("/:roomId", async (c) => {
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, c.req.param("roomId"), member.id)
  if (!room)
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "ルームが見つかりません")
  if (room.kind !== "custom")
    return apiError(
      c,
      409,
      "AUTOMATIC_ROOM",
      "このルームへの参加はシフト・年度から決まります"
    )
  try {
    await c.env.shift_app
      .prepare(
        "INSERT OR IGNORE INTO chat_room_exits(room_id,member_id,created_at) VALUES(?,?,?)"
      )
      .bind(room.id, member.id, Date.now())
      .run()
  } catch (error) {
    if (error instanceof Error && error.message.includes("LAST_CHAT_MANAGER"))
      return apiError(
        c,
        409,
        "LAST_CHAT_MANAGER",
        "ほかの人に設定変更権限を付けるか、ルームを閉じてから退出してください"
      )
    throw error
  }
  return c.body(null, 204)
})
