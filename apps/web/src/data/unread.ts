type Room = {
  lastRead: number
  lastSequence: number
  unreadCount: number
  updatedAt: string
}
type Message = {
  sequence: number
  memberId: string
  createdAt: string
  deleted?: boolean | undefined
}

/** Unread means someone else's message, still standing, after the member's read position. */
export const isUnread = (
  message: Pick<Message, "sequence" | "memberId" | "deleted">,
  memberId: string,
  lastRead: number
) =>
  message.memberId !== memberId &&
  !message.deleted &&
  message.sequence > lastRead

/**
 * A room after one of its messages arrives. The server counts unread messages;
 * a new one from someone else adds one here. `null` means only the server can
 * tell, as when a message that may have been counted is deleted.
 */
export function roomAfterMessage<T extends Room>(
  room: T,
  message: Message,
  memberId: string
): T | null {
  if (message.sequence > room.lastSequence)
    return {
      ...room,
      lastSequence: message.sequence,
      updatedAt: message.createdAt,
      unreadCount:
        room.unreadCount + (isUnread(message, memberId, room.lastRead) ? 1 : 0),
    }
  if (
    message.deleted &&
    isUnread({ ...message, deleted: false }, memberId, room.lastRead)
  )
    return null
  return room
}

/**
 * A room read through `sequence`. Reading the newest message leaves nothing
 * unread; `null` leaves an earlier position's count to the server.
 */
export function roomReadThrough<T extends Room>(
  room: T,
  sequence: number
): T | null {
  const lastRead = Math.max(room.lastRead, sequence)
  return lastRead >= room.lastSequence
    ? { ...room, lastRead, unreadCount: 0 }
    : null
}
