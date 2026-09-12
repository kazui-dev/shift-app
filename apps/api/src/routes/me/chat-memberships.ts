import { Hono } from "hono"
import { apiError, type ApiEnv } from "../../lib/http"
import { findAccessibleRoom } from "../../services/chat-access"
import { chatPermissions } from "../../services/chat-permissions"
export const chatMembershipsApp = new Hono<ApiEnv>()
chatMembershipsApp.delete("/:roomId", async (c) => {
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, c.req.param("roomId"), member.id)
  if (!room)
    return apiError(c, 404, "CHAT_ROOM_NOT_FOUND", "ルームが見つかりません")
  if (room.exitedAt !== null) return c.body(null, 204)
  if (!room.allowExit)
    return apiError(c, 409, "EXIT_DISABLED", "このルームは退出できません")
  const result = await c.env.shift_app
    .prepare(`${chatPermissions}
    INSERT OR IGNORE INTO chat_room_exits(room_id,member_id,created_at)
    SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM chat_rooms r JOIN chat_permissions p ON p.room_id=r.id WHERE r.id=? AND r.allow_exit=1 AND p.member_id=?)
    AND (NOT EXISTS(SELECT 1 FROM chat_permissions WHERE room_id=? AND member_id=? AND can_manage=1)
    OR EXISTS(SELECT 1 FROM chat_permissions WHERE room_id=? AND member_id<>? AND can_manage=1)
    OR NOT EXISTS(SELECT 1 FROM chat_permissions WHERE room_id=? AND member_id<>?)) RETURNING room_id`)
    .bind(
      room.id,
      member.id,
      Date.now(),
      room.id,
      member.id,
      room.id,
      member.id,
      room.id,
      member.id,
      room.id,
      member.id
    )
    .all()
  if (!result.results.length)
    return apiError(
      c,
      409,
      "LAST_CHAT_MANAGER",
      "ほかの人に設定変更権限を付けてから退出してください"
    )
  return c.body(null, 204)
})
