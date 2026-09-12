import { expect, it } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import { roomsQuery, messagesQuery } from "./chat"
import { receiveMessage, removeRoom } from "./chat-cache"

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
    historical: false,
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
