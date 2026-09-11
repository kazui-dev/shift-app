import { expect, it, vi } from "vite-plus/test"
import { QueryClient } from "@tanstack/react-query"
import { prepareConversation } from "@/data/chat"
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
