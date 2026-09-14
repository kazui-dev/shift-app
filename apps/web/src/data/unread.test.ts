import { expect, it } from "vite-plus/test"
import { isUnread, roomAfterMessage, roomReadThrough } from "@/data/unread"

const room = {
  lastRead: 2,
  lastSequence: 3,
  unreadCount: 1,
  updatedAt: "2026-09-14T00:00:00Z",
}
const message = (sequence: number, change: object = {}) => ({
  sequence,
  memberId: "other",
  createdAt: `2026-09-14T00:0${sequence}:00Z`,
  ...change,
})

it("counts only others' standing messages after the read position", () => {
  expect(isUnread(message(3), "me", 2)).toBe(true)
  expect(isUnread(message(3, { memberId: "me" }), "me", 2)).toBe(false)
  expect(isUnread(message(3, { deleted: true }), "me", 2)).toBe(false)
  expect(isUnread(message(2), "me", 2)).toBe(false)
})

it("adds a new message from someone else once, and never an own one", () => {
  const arrived = roomAfterMessage(room, message(4), "me")
  expect(arrived).toEqual({
    ...room,
    lastSequence: 4,
    updatedAt: message(4).createdAt,
    unreadCount: 2,
  })
  if (!arrived) throw Error("Missing room")
  expect(roomAfterMessage(arrived, message(4), "me")).toBe(arrived)
  expect(
    roomAfterMessage(room, message(4, { memberId: "me" }), "me")
  ).toMatchObject({ lastSequence: 4, unreadCount: 1 })
})

it("leaves the count to the server when a message that may have counted is deleted", () => {
  expect(roomAfterMessage(room, message(3, { deleted: true }), "me")).toBeNull()
  expect(
    roomAfterMessage(room, message(3, { deleted: true, memberId: "me" }), "me")
  ).toBe(room)
  expect(roomAfterMessage(room, message(1, { deleted: true }), "me")).toBe(room)
})

it("clears a room read through its newest message and leaves an earlier position to the server", () => {
  expect(roomReadThrough(room, 3)).toEqual({
    ...room,
    lastRead: 3,
    unreadCount: 0,
  })
  expect(roomReadThrough({ ...room, lastSequence: 5 }, 3)).toBeNull()
})
