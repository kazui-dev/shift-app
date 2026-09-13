import { Hono } from "hono"
import { apiError, errors } from "../../lib/errors"
import { type ApiEnv } from "../../lib/http"
import { findAccessibleRoom } from "../../services/chat-access"
import { publishRoomChange } from "../../services/chat-directory"
import {
  roomRecipients,
  roomPermissions,
} from "../../services/chat-permissions"
export const chatMembershipsApp = new Hono<ApiEnv>()
chatMembershipsApp.delete("/:roomId", async (c) => {
  const member = c.get("member")
  const room = await findAccessibleRoom(c.env, c.req.param("roomId"), member.id)
  if (!room) return apiError(c, errors.chatRoomNotFound)
  if (!room.allowExit) return apiError(c, errors.chatExitDisabled)
  const previous = await roomRecipients(c.env, room.id)
  const result = await c.env.shift_app
    .prepare(`${roomPermissions}
    INSERT OR IGNORE INTO chat_room_exits(room_id,member_id,created_at)
    SELECT id,?,? FROM chat_scope WHERE EXISTS(SELECT 1 FROM chat_rooms r JOIN chat_permissions p ON p.room_id=r.id WHERE r.allow_exit=1 AND p.member_id=?)
    AND (NOT EXISTS(SELECT 1 FROM chat_permissions WHERE member_id=? AND can_manage=1)
    OR EXISTS(SELECT 1 FROM chat_permissions WHERE member_id<>? AND can_manage=1)
    OR NOT EXISTS(SELECT 1 FROM chat_permissions WHERE member_id<>?)) RETURNING room_id`)
    .bind(
      room.id,
      member.id,
      Date.now(),
      member.id,
      member.id,
      member.id,
      member.id
    )
    .all()
  if (!result.results.length) return apiError(c, errors.lastChatManager)
  c.executionCtx.waitUntil(
    publishRoomChange(
      c.env,
      room.id,
      previous.map((recipient) => recipient.id)
    )
  )
  return c.body(null, 204)
})
