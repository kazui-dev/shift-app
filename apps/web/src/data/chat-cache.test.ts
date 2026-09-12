import { expect, it } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import { roomsQuery, messagesQuery } from "./chat"
import {
  receiveMessage,
  removeRoom,
  optimisticallyDeleteMessage,
} from "./chat-cache"

const message = (sequence: number) => ({
  sequence,
  id: `id-${sequence}`,
  memberId: "member",
  memberDisplayName: "名前",
  memberImage: null,
  content: "本文",
  attachments: [],
  createdAt: "2026-09-12T00:00:00Z",
})

it("removes deleted room history and image context without discarding other rooms", () => {
  const client = new QueryClient()
  client.setQueryData(["chat-rooms", 2026], {
    rooms: [{ id: "deleted" }, { id: "kept" }],
  })
  client.setQueryData(["chat-messages", "deleted"], {
    pages: [{ messages: [message(1)] }],
  })
  client.setQueryData(["chat-image-message", "deleted", 1], {
    messages: [message(1)],
  })
  client.setQueryData(["chat-messages", "kept"], { pages: [] })
  removeRoom(client, "deleted")
  expect(client.getQueryData(["chat-rooms", 2026])).toEqual({
    rooms: [{ id: "kept" }],
  })
  expect(client.getQueryData(["chat-messages", "deleted"])).toBeUndefined()
  expect(
    client.getQueryData(["chat-image-message", "deleted", 1])
  ).toBeUndefined()
  expect(client.getQueryData(["chat-messages", "kept"])).toEqual({ pages: [] })
  client.clear()
})
it("merges delivery and websocket acknowledgements without duplicates or refetching a continuous history", () => {
  const client = new QueryClient()
  const key = messagesQuery("room").queryKey
  client.setQueryData(key, {
    pages: [
      { messages: [message(2)], hasMore: true },
      { messages: [message(1)], hasMore: false },
    ],
    pageParams: [null, 2],
  })
  expect(receiveMessage(client, "room", message(3))).toBe(true)
  expect(receiveMessage(client, "room", message(3))).toBe(true)
  expect(
    receiveMessage(client, "room", { ...message(1), content: "canonical" })
  ).toBe(true)
  expect(
    client
      .getQueryData(key)
      ?.pages.map((page) => page.messages.map((item) => item.sequence))
  ).toEqual([[2, 3], [1]])
  expect(client.getQueryData(key)?.pages[1]?.messages[0]?.content).toBe(
    "canonical"
  )
  expect(receiveMessage(client, "room", message(5))).toBe(false)
  expect(client.getQueryData(key)?.pages[0]?.messages.at(-1)?.sequence).toBe(3)
  expect(receiveMessage(client, "unread-room", message(9))).toBe(false)
  expect(
    client.getQueryData(messagesQuery("unread-room").queryKey)
  ).toBeUndefined()
  client.clear()
})

it("reorders rooms immediately on new delivery without letting old acknowledgements change their position", () => {
  const client = new QueryClient()
  const room = (id: string, updatedAt: string) => ({
    id,
    updatedAt,
    createdAt: updatedAt,
    year: 2026,
    name: id,
    createdBy: "member",
    allowExit: true,
    activityId: null,
    activityStartsAt: null,
    activityEndsAt: null,
    canPost: true,
    canManage: true,
    muted: false,
    lastRead: 0,
    lastSequence: 1,
    unreadCount: 1,
  })
  const key = roomsQuery(2026).queryKey
  client.setQueryData(key, {
    rooms: [
      room("one", "2026-09-12T01:00:00Z"),
      room("two", "2026-09-12T00:00:00Z"),
    ],
  })
  const delivered = { ...message(2), createdAt: "2026-09-12T02:00:00Z" }
  receiveMessage(client, "two", delivered)
  expect(client.getQueryData(key)?.rooms.map((item) => item.id)).toEqual([
    "two",
    "one",
  ])
  receiveMessage(client, "two", message(1))
  receiveMessage(client, "two", delivered)
  expect(client.getQueryData(key)?.rooms.map((item) => item.id)).toEqual([
    "two",
    "one",
  ])
  expect(client.getQueryData(key)?.rooms[0]?.updatedAt).toBe(
    delivered.createdAt
  )
  client.clear()
})

it("acknowledges an own message in the visible room without an intermediate unread badge", () => {
  const client = new QueryClient()
  client.setQueryData(["chat-room", "room"], {
    room: { id: "room", lastRead: 1, lastSequence: 1, unreadCount: 0 },
  })
  const counts: number[] = []
  const stop = client.getQueryCache().subscribe(() => {
    const data = client.getQueryData<{ room: { unreadCount: number } }>([
      "chat-room",
      "room",
    ])
    if (data) counts.push(data.room.unreadCount)
  })
  receiveMessage(client, "room", message(2), true)
  receiveMessage(client, "room", message(2), true)
  expect(counts.every((count) => count === 0)).toBe(true)
  expect(client.getQueryData(["chat-room", "room"])).toMatchObject({
    room: { lastRead: 2, lastSequence: 2, unreadCount: 0 },
  })
  receiveMessage(client, "room", message(3))
  expect(client.getQueryData(["chat-room", "room"])).toMatchObject({
    room: { unreadCount: 1 },
  })
  stop()
  client.clear()
})

it("immediately hides a deleted message and its reply details, and rolls back only its own changes", () => {
  const client = new QueryClient()
  const key = messagesQuery("room").queryKey
  const original = message(1)
  const reply = {
    ...message(2),
    reply: {
      id: original.id,
      sequence: 1,
      memberDisplayName: "名前",
      content: original.content,
    },
  }
  client.setQueryData(key, {
    pages: [{ messages: [original, reply], hasMore: false }],
    pageParams: [null],
  })
  const rollback = optimisticallyDeleteMessage(client, "room", original.id)
  expect(client.getQueryData(key)?.pages[0]?.messages).toMatchObject([
    { deleted: true, content: "" },
    { reply: { deleted: true, content: "" } },
  ])
  receiveMessage(client, "room", message(3))
  rollback()
  expect(client.getQueryData(key)?.pages[0]?.messages).toEqual([
    original,
    reply,
    message(3),
  ])
  const rollbackAgain = optimisticallyDeleteMessage(client, "room", original.id)
  const updated = { ...reply, content: "changed concurrently" }
  receiveMessage(client, "room", updated)
  rollbackAgain()
  expect(client.getQueryData(key)?.pages[0]?.messages[1]).toEqual(updated)
  receiveMessage(client, "room", { ...original, deleted: true, content: "" })
  expect(client.getQueryData(key)?.pages[0]?.messages[1]?.reply).toMatchObject({
    deleted: true,
    content: "",
  })
  client.clear()
})

it("updates unloaded reply targets without inserting an old sequence into the newest page", () => {
  const client = new QueryClient()
  const key = messagesQuery("room").queryKey
  client.setQueryData(key, {
    pages: [
      {
        messages: [
          {
            ...message(100),
            reply: {
              id: "id-1",
              sequence: 1,
              memberDisplayName: "名前",
              content: "本文",
            },
          },
        ],
        hasMore: true,
      },
    ],
    pageParams: [null],
  })
  receiveMessage(client, "room", { ...message(1), deleted: true, content: "" })
  expect(client.getQueryData(key)?.pages[0]?.messages).toMatchObject([
    { sequence: 100, reply: { deleted: true, content: "" } },
  ])
  client.clear()
})
