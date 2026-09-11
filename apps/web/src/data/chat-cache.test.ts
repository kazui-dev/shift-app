import { expect, it } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import { messagesQuery } from "./chat"
import { receiveMessage } from "./chat-cache"

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
