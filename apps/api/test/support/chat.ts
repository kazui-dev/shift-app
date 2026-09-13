import type { RoomRow } from "../../src/services/chat-access"

/** A readable room the member may post in, with any fields changed. */
export const chatRoom = (change: Partial<RoomRow> = {}): RoomRow => ({
  id: "10000000-0000-4000-8000-000000000001",
  year: 2026,
  name: "連絡",
  createdBy: "m",
  createdAt: 0,
  updatedAt: 0,
  allowExit: 1,
  activityId: null,
  activityStartsAt: null,
  activityEndsAt: null,
  canPost: 1,
  canManage: 0,
  muted: 0,
  lastRead: 0,
  lastSequence: 0,
  ...change,
})
