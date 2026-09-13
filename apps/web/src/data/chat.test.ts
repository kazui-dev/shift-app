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

const image = (id: string) => ({ id, width: 400, height: 300 })
const message = (
  index: number,
  change: Partial<Parameters<typeof warmTargets>[0][number]> = {}
) => ({
  id: `m${index}`,
  content: "text",
  memberImage: null,
  attachments: [],
  ...change,
})

it("warms what fills two screens, newest first, skipping deleted messages", () => {
  // Each text message stands 66px, so two 300px screens take ten of them.
  const messages = Array.from({ length: 20 }, (_, index) =>
    message(index, index === 15 ? { deleted: true, content: "" } : {})
  )
  expect(warmTargets(messages, { width: 400, height: 300 }).links).toEqual([])
  const ids = warmTargets(
    messages.map((item) => ({
      ...item,
      content: `${item.id} https://example.com/${item.id}`,
    })),
    { width: 400, height: 300 }
  ).links.map((link) => link.messageId)
  expect(ids).toEqual(["m17", "m18", "m19"])
  expect(warmTargets([], { width: 400, height: 300 })).toEqual({
    images: [],
    avatars: [],
    links: [],
  })
})

it("warms each image at its tile's size, and every avatar and first link on screen", () => {
  const messages = [
    message(1, {
      attachments: [image("a"), image("b"), image("c")],
      memberImage: "https://example.com/one.png",
    }),
    message(2, {
      content: "https://example.com/a https://example.com/b",
      memberImage: "https://example.com/one.png",
      reply: {},
    }),
    message(3, { attachments: [image("d")] }),
  ]
  expect(warmTargets(messages, { width: 400, height: 1000 })).toEqual({
    images: [
      { id: "a", size: 1280 },
      { id: "b", size: 640 },
      { id: "c", size: 640 },
      { id: "d", size: 1280 },
    ],
    avatars: ["https://example.com/one.png"],
    links: [{ messageId: "m2", url: "https://example.com/a" }],
  })
})

it("counts tall image frames, so fewer messages fill the screens", () => {
  const rows = Array.from({ length: 7 }, (_, index) => image(`r${index}`))
  const messages = [message(1), message(2, { attachments: rows })]
  expect(
    warmTargets(messages, { width: 400, height: 200 }).images.map(
      (item) => item.id
    )
  ).toEqual(rows.map((item) => item.id))
})
