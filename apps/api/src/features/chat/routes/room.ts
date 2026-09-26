import type { Context } from "hono"
import { createMiddleware } from "hono/factory"
import type { Reader } from "../services/private-messages"
import { apiError, errors } from "../../../lib/errors"
import type { ApiEnv } from "../../../lib/http"
import { findAccessibleRoom, type RoomRow } from "../services/chat-access"
import { readsPrivate } from "../services/private-messages"

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

/**
 * The member as a reader of the room's private messages. Only shift rooms
 * hold them, so other rooms skip the lookup.
 */
export async function roomReader(c: Context<RoomEnv>): Promise<Reader> {
  const room = c.get("room"),
    memberId = c.get("member").id
  return {
    memberId,
    readsPrivate:
      room.activityId !== null &&
      (await readsPrivate(c.env, room.id, memberId)),
  }
}
