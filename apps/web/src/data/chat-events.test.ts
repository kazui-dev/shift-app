import { expect, it, vi } from "vite-plus/test"
import { keys } from "@/data/keys"
import { QueryClient } from "@tanstack/react-query"
import { applyChatEvent } from "./chat-events"
import { roomsQuery, messagesQuery } from "./chat"
const room = (id: string, updatedAt: string) => ({
  id,
  year: 2026,
  name: id,
  createdBy: "me",
  createdAt: updatedAt,
  updatedAt,
  allowExit: true,
  activityId: null,
  activityStartsAt: null,
  activityEndsAt: null,
  canPost: true,
  canManage: true,
  muted: false,
  lastRead: 1,
  lastSequence: 1,
  unreadCount: 0,
})
const message = {
  id: "message",
  sequence: 2,
  memberId: "me",
  memberDisplayName: "自分",
  memberImage: null,
  content: "本文",
  createdAt: "2026-09-13T02:00:00Z",
  attachments: [],
  linkPreview: null,
  version: 1,
}
it("updates order in unopened rooms and atomically keeps visible own posts read on the same event stream", () => {
  const client = new QueryClient()
  const key = roomsQuery(2026).queryKey
  client.setQueryData(key, {
    rooms: [
      room("first", "2026-09-13T01:00:00Z"),
      room("second", "2026-09-13T00:00:00Z"),
    ],
  })
  applyChatEvent(
    client,
    {
      type: "message",
      roomId: "second",
      message: { ...message, memberId: "other" },
    },
    "me"
  )
  expect(client.getQueryData(key)?.rooms.map((item) => item.id)).toEqual([
    "second",
    "first",
  ])
  expect(client.getQueryData(key)?.rooms[0]?.unreadCount).toBe(1)
  applyChatEvent(client, { type: "message", roomId: "first", message }, "me")
  expect(
    client.getQueryData(key)?.rooms.find((item) => item.id === "first")
      ?.unreadCount
  ).toBe(0)
  applyChatEvent(
    client,
    { type: "preferences_changed", roomId: "second", lastRead: 2, muted: true },
    "me"
  )
  expect(
    client.getQueryData(key)?.rooms.find((item) => item.id === "second")
  ).toMatchObject({ lastRead: 2, unreadCount: 0, muted: true })
  applyChatEvent(
    client,
    { type: "preferences_changed", roomId: "second", lastRead: 1, muted: true },
    "me"
  )
  expect(
    client.getQueryData(key)?.rooms.find((item) => item.id === "second")
      ?.lastRead
  ).toBe(2)
  client.clear()
})
it("applies edited content immediately and refreshes room access and history on changes and reconnects", () => {
  const client = new QueryClient()
  const key = messagesQuery("room").queryKey
  client.setQueryData(key, {
    pages: [{ messages: [message], hasMore: false }],
    pageParams: [null],
  })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  applyChatEvent(
    client,
    {
      type: "message_changed",
      roomId: "room",
      message: { ...message, content: "編集" },
    },
    "me"
  )
  expect(client.getQueryData(key)?.pages[0]?.messages[0]?.content).toBe("編集")
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: keys.chatImageMessage("room"),
  })
  applyChatEvent(client, { type: "room_changed", roomId: "room" }, "me")
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: keys.chatMembers("room"),
  })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.chatRoom("room") })
  applyChatEvent(client, null, "me")
  expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.chatMessages() })
  client.clear()
})

it("never publishes an unread badge for an own post received from another device", () => {
  const client = new QueryClient()
  const key = roomsQuery(2026).queryKey
  client.setQueryData(key, { rooms: [room("room", "2026-09-13T00:00:00Z")] })
  const unread: number[] = []
  const unsubscribe = client.getQueryCache().subscribe(() => {
    const count = client.getQueryData(key)?.rooms[0]?.unreadCount
    if (count !== undefined) unread.push(count)
  })
  applyChatEvent(client, { type: "message", roomId: "room", message }, "me")
  applyChatEvent(
    client,
    { type: "preferences_changed", roomId: "room", lastRead: 1, muted: false },
    "me"
  )
  expect(unread.length).toBeGreaterThan(0)
  expect(unread.every((count) => count === 0)).toBe(true)
  expect(client.getQueryData(key)?.rooms[0]?.lastRead).toBe(2)
  unsubscribe()
  client.clear()
})

it("removes an exited chat and its cached history on the same event stream", () => {
  const client = new QueryClient()
  const key = roomsQuery(2026).queryKey
  client.setQueryData(key, {
    rooms: [room("left", message.createdAt), room("kept", message.createdAt)],
  })
  client.setQueryData(messagesQuery("left").queryKey, {
    pages: [{ messages: [message], hasMore: false }],
    pageParams: [null],
  })
  client.setQueryData(["chat-room", "left"], {
    room: room("left", message.createdAt),
  })
  applyChatEvent(client, { type: "room_removed", roomId: "left" }, "me")
  expect(client.getQueryData(key)?.rooms.map((item) => item.id)).toEqual([
    "kept",
  ])
  expect(client.getQueryData(messagesQuery("left").queryKey)).toBeUndefined()
  expect(client.getQueryData(["chat-room", "left"])).toBeUndefined()
  client.clear()
})

it("never counts an own post as unread, even when its card arrives before the post itself", () => {
  const client = new QueryClient()
  const key = roomsQuery(2026).queryKey
  client.setQueryData(key, { rooms: [room("room", "2026-09-13T00:00:00Z")] })
  client.setQueryData(messagesQuery("room").queryKey, {
    pages: [
      {
        messages: [{ ...message, sequence: 1, id: "earlier" }],
        hasMore: false,
      },
    ],
    pageParams: [null],
  })
  const unread: number[] = []
  const unsubscribe = client.getQueryCache().subscribe(() => {
    const count = client.getQueryData(key)?.rooms[0]?.unreadCount
    if (count !== undefined) unread.push(count)
  })
  const invalidate = vi.spyOn(client, "invalidateQueries")
  applyChatEvent(
    client,
    {
      type: "message_changed",
      roomId: "room",
      message: { ...message, version: 2 },
    },
    "me"
  )
  applyChatEvent(client, { type: "message", roomId: "room", message }, "me")
  expect(unread.every((count) => count === 0)).toBe(true)
  expect(
    client
      .getQueryData(messagesQuery("room").queryKey)
      ?.pages[0]?.messages.at(-1)?.version
  ).toBe(2)
  expect(invalidate).not.toHaveBeenCalledWith({
    queryKey: keys.chatMessages("room"),
  })
  unsubscribe()
  client.clear()
})
