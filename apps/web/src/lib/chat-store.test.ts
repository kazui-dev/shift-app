import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { get, set } from "idb-keyval"
import { sendChatMessage, uploadChatImage } from "@/api/chat"
import { ChatStore } from "./chat-store"

vi.mock("idb-keyval", () => ({
  createStore: () => ({}),
  get: vi.fn<typeof get>(),
  set: vi.fn<typeof set>(),
  clear: vi.fn<() => Promise<void>>(),
}))
vi.mock("@/api/chat", () => ({
  sendChatMessage: vi.fn<typeof sendChatMessage>(),
  uploadChatImage: vi.fn<typeof uploadChatImage>(),
}))
vi.mock("@workspace/ui/lib/toast", () => ({
  toast: { error: vi.fn<() => void>() },
}))
const active: ChatStore[] = []
async function store() {
  const result = new ChatStore("member")
  active.push(result)
  await vi.waitFor(() => expect(result.snapshot().ready).toBe(true))
  return result
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal("navigator", { onLine: true })
  vi.mocked(get).mockResolvedValue(undefined)
  vi.mocked(set).mockResolvedValue(undefined)
})
afterEach(() => {
  active.splice(0).forEach((item) => item.stop())
  vi.unstubAllGlobals()
})
it("keeps independent room drafts and persists image blobs before queuing offline", async () => {
  const value = await store(),
    blob = new Blob(["image"], { type: "image/png" })
  value.edit("one", {
    content: "下書き",
    files: [{ id: "file", name: "写真.png", blob }],
  })
  value.edit("two", { content: "別のルーム", files: [] })
  vi.stubGlobal("navigator", { onLine: false })
  await value.enqueue("one")
  await value.flush()
  expect(value.draft("two").content).toBe("別のルーム")
  expect(value.draft("one").content).toBe("")
  expect(value.snapshot().queue[0]?.files[0]?.blob).toBe(blob)
  expect(sendChatMessage).not.toHaveBeenCalled()
  expect(set).toHaveBeenCalled()
})
it("retains a failed message and reuses its id and uploaded image on retry", async () => {
  const value = await store()
  value.edit("one", {
    content: "",
    files: [{ id: "f", name: "photo.png", blob: new Blob(["image"]) }],
  })
  const attachment = {
    id: crypto.randomUUID(),
    width: 20,
    height: 30,
    bytes: 100,
  }
  vi.mocked(uploadChatImage).mockResolvedValue({ attachment })
  vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error("Unavailable"))
  await value.enqueue("one")
  await value.flush()
  const queued = value.snapshot().queue[0]
  expect(queued?.status).toBe("failed")
  expect(queued?.files[0]?.uploaded).toEqual(attachment)
  if (!queued) throw new Error("Missing retained message")
  vi.mocked(sendChatMessage).mockResolvedValue({
    message: {
      id: queued.id,
      sequence: 1,
      memberId: "m",
      memberDisplayName: "名前",
      content: "",
      createdAt: new Date().toISOString(),
      attachments: [attachment],
    },
  })
  value.retry(queued.id)
  await value.flush()
  expect(uploadChatImage).toHaveBeenCalledTimes(1)
  expect(sendChatMessage).toHaveBeenNthCalledWith(2, "one", {
    id: queued.id,
    content: "",
    attachmentIds: [attachment.id],
  })
  expect(value.snapshot().queue).toEqual([])
})
it("does not send when durable local storage fails", async () => {
  const value = await store()
  value.edit("one", { content: "残す", files: [] })
  vi.mocked(set).mockRejectedValue(new Error("Quota exceeded"))
  await value.enqueue("one")
  await value.flush()
  expect(value.draft("one").content).toBe("残す")
  expect(sendChatMessage).not.toHaveBeenCalled()
})
it("restores persisted drafts and interrupted uploads after reload", async () => {
  vi.mocked(get).mockResolvedValue({
    version: 2,
    drafts: { two: { content: "再開", files: [] } },
    queue: [
      {
        id: crypto.randomUUID(),
        roomId: "one",
        content: "送信",
        files: [],
        status: "sending",
      },
    ],
  })
  const value = await store()
  expect(value.draft("two").content).toBe("再開")
  await value.flush()
  expect(sendChatMessage).toHaveBeenCalledTimes(1)
  expect(value.snapshot().queue).toEqual([])
})

it("discards incompatible saved queues instead of replaying them", async () => {
  vi.mocked(get).mockResolvedValue({
    version: 1,
    drafts: { one: { content: "old", files: [] } },
    queue: [
      {
        id: crypto.randomUUID(),
        roomId: "one",
        content: "old",
        files: [],
        status: "waiting",
      },
    ],
  })
  const value = await store()
  await value.flush()
  expect(value.draft("one").content).toBe("")
  expect(value.snapshot().queue).toEqual([])
  expect(sendChatMessage).not.toHaveBeenCalled()
})
