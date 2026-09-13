import { expect, it, vi } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import { prepareConversation, warmTargets } from "@/data/chat"
import { getChatMessages, getChatRoom } from "@/api/chat"
vi.mock("@/api/chat", () => ({
  getChatMessages: vi.fn<typeof getChatMessages>(),
  getChatRoom: vi.fn<typeof getChatRoom>(),
}))
it("starts history without waiting for room details and deduplicates intent", async () => {
  vi.mocked(getChatRoom).mockImplementation(() => new Promise(() => {}))
  vi.mocked(getChatMessages).mockImplementation(() => new Promise(() => {}))
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  void prepareConversation(client, "room")
  void prepareConversation(client, "room")
  expect(getChatRoom).toHaveBeenCalledTimes(1)
  expect(getChatMessages).toHaveBeenCalledTimes(1)
  await client.cancelQueries()
  client.clear()
})

it("warms about one screen: the last 15 messages, up to 6 images and each first link", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    id: `m${index}`,
    content:
      index === 19
        ? "https://example.com/a https://example.com/b"
        : index === 3
          ? "https://old.example.com"
          : "",
    attachments: index >= 16 ? [{ id: `a${index}` }, { id: `b${index}` }] : [],
  }))
  expect(warmTargets(messages)).toEqual({
    images: ["a17", "b17", "a18", "b18", "a19", "b19"],
    links: [{ messageId: "m19", url: "https://example.com/a" }],
  })
  expect(warmTargets([])).toEqual({ images: [], links: [] })
})
