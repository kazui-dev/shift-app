import { createMiddleware } from "hono/factory"
import { apiError, errors } from "../../lib/errors"
import type { ApiEnv } from "../../lib/http"
import { findAccessibleRoom, type RoomRow } from "../../services/chat-access"

export type RoomEnv = {
  Bindings: CloudflareBindings
  Variables: ApiEnv["Variables"] & { room: RoomRow }
}

/** Resolves the conversation the member may read, or answers 404. */
export const readableRoom = createMiddleware<RoomEnv>(async (c, next) => {
  const room = await findAccessibleRoom(
    c.env,
    c.req.param("roomId") ?? "",
    c.get("member").id
  )
  if (!room) return apiError(c, errors.chatRoomNotFound)
  c.set("room", room)
  return next()
})
