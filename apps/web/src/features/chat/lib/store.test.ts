import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { loadChat as get, saveChat as set } from "@/features/chat/lib/storage"
import { toast } from "@workspace/ui/lib/toast"
import {
  deleteChatAttachment,
  deleteChatMessage,
  keepChatImageCopy,
  sendChatMessage,
  uploadChatImage,
  uploadChatOriginal,
} from "@/features/chat/api/chat"
import { ApiError, ApiNetworkError } from "@/lib/http/client"
import { displayCopy } from "@/features/chat/lib/copy"
import { ChatStore } from "@/features/chat/lib/store"

vi.mock("./storage", () => ({
  loadChat: vi.fn<typeof get>(),
  saveChat: vi.fn<typeof set>(),
  clearChat: vi.fn<() => Promise<void>>(),
}))
vi.mock("@/features/chat/api/chat", () => ({
  deleteChatAttachment: vi.fn<typeof deleteChatAttachment>(),
  deleteChatMessage: vi.fn<typeof deleteChatMessage>(),
  keepChatImageCopy: vi.fn<typeof keepChatImageCopy>(),
  uploadChatOriginal: vi.fn<typeof uploadChatOriginal>(),
  sendChatMessage: vi.fn<typeof sendChatMessage>(),
  uploadChatImage: vi.fn<typeof uploadChatImage>(),
}))
vi.mock("@/features/chat/lib/copy", () => ({
  displayCopy: vi.fn<typeof displayCopy>(),
}))
vi.mock("@workspace/ui/lib/toast", () => ({
  toast: { error: vi.fn<() => void>() },
}))
const uploaded = (name: string) => ({
  id: crypto.randomUUID(),
  width: 20,
  height: 30,
  bytes: 100,
  name,
  original: true,
})
const sent = (id: string, attachmentIds: string[] = []) => ({
  message: {
    id,
    sequence: 1,
    memberId: "m",
    memberDisplayName: "名前",
    memberImage: null,
    content: "",
    createdAt: new Date().toISOString(),
    attachments: attachmentIds.map((attachment) => ({
      ...uploaded("photo.png"),
      id: attachment,
    })),
    linkPreview: null,
    version: 1,
  },
})
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
  vi.mocked(deleteChatAttachment).mockResolvedValue(undefined)
  vi.mocked(displayCopy).mockResolvedValue(null)
  vi.mocked(uploadChatOriginal).mockResolvedValue(undefined)
  vi.mocked(keepChatImageCopy).mockResolvedValue(undefined)
  vi.mocked(uploadChatImage).mockImplementation(async (_room, file) => ({
    attachment: uploaded(file.name),
  }))
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
  const attachment = {
    id: crypto.randomUUID(),
    width: 20,
    height: 30,
    bytes: 100,
    name: "photo.png",
    original: true,
  }
  vi.mocked(uploadChatImage).mockResolvedValue({ attachment })
  value.edit("one", {
    content: "",
    files: [{ id: "f", name: "photo.png", blob: new Blob(["image"]) }],
  })
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
      memberImage: null,
      memberDisplayName: "名前",
      content: "",
      createdAt: new Date().toISOString(),
      attachments: [attachment],
      linkPreview: null,
      version: 1,
    },
  })
  value.retry(queued.id)
  const confirm = vi.fn<(roomId: string, message: { id: string }) => void>(
    (roomId, message) => {
      expect(roomId).toBe("one")
      expect(message.id).toBe(queued.id)
      expect(
        value.snapshot().queue.some((item) => item.id === message.id)
      ).toBe(true)
    }
  )
  await value.flush(confirm)
  expect(confirm).toHaveBeenCalledTimes(1)
  expect(uploadChatImage).toHaveBeenCalledTimes(1)
  expect(uploadChatImage).toHaveBeenCalledWith(
    "one",
    expect.objectContaining({ name: "photo.png" }),
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  )
  expect(sendChatMessage).toHaveBeenNthCalledWith(
    2,
    "one",
    { id: queued.id, content: "", attachmentIds: [attachment.id] },
    expect.any(AbortSignal)
  )
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
    version: 5,
    originals: [],
    drafts: {
      two: {
        content: "再開",
        files: [
          {
            id: "photo",
            name: "写真.png",
            blob: new Blob(["image"]),
            dimensions: { width: 120, height: 80 },
          },
        ],
      },
    },
    queue: [
      {
        id: crypto.randomUUID(),
        roomId: "one",
        createdAt: new Date().toISOString(),
        content: "送信",
        files: [],
        status: "sending",
      },
    ],
  })
  const value = await store()
  expect(value.draft("two").content).toBe("再開")
  expect(value.draft("two").files[0]?.dimensions).toEqual({
    width: 120,
    height: 80,
  })
  vi.mocked(sendChatMessage).mockResolvedValue({
    message: {
      id: crypto.randomUUID(),
      sequence: 1,
      memberId: "m",
      memberDisplayName: "名前",
      memberImage: null,
      content: "送信",
      attachments: [],
      linkPreview: null,
      version: 1,
      createdAt: new Date().toISOString(),
    },
  })
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
        createdAt: new Date().toISOString(),
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

it("keeps the draft when local storage is full", async () => {
  const value = await store()
  vi.mocked(set).mockRejectedValue(
    new DOMException("Full", "QuotaExceededError")
  )
  value.edit("one", { content: "消さない", files: [] })
  await vi.waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "端末の空き容量が足りず、入力内容を保存できません。",
      {
        id: "chat-storage",
      }
    )
  )
  expect(value.draft("one").content).toBe("消さない")
})

it("waits for restored drafts before an app update can persist and reload", async () => {
  let restore: ((value: unknown) => void) | undefined
  vi.mocked(get).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        restore = resolve
      })
  )
  const value = new ChatStore("member")
  active.push(value)
  let settled = false
  const waiting = value.settle().then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)
  expect(set).not.toHaveBeenCalled()
  restore?.({
    version: 5,
    originals: [],
    drafts: { one: { content: "更新前の入力", files: [] } },
    queue: [],
  })
  await waiting
  expect(value.draft("one").content).toBe("更新前の入力")
  expect(settled).toBe(true)
})
it("coalesces rapid edits into the latest snapshot", async () => {
  const value = await store()
  vi.mocked(set).mockClear()
  for (const content of ["a", "ab", "abc"])
    value.edit("one", { content, files: [] })
  await value.settle()
  expect(set).toHaveBeenCalledTimes(1)
  expect(vi.mocked(set).mock.calls[0]?.[1].drafts["one"]?.content).toBe("abc")
})

it("persists a reply target with the queued draft and includes it when sending", async () => {
  const value = await store()
  const reply = {
    id: "10000000-0000-4000-8000-000000000001",
    sequence: 1,
    memberDisplayName: "Author",
    content: "Original",
  }
  value.edit("room", { content: "Reply", files: [], reply })
  await value.enqueue("room")
  expect(value.snapshot().queue[0]?.reply).toEqual(reply)
  vi.mocked(sendChatMessage).mockResolvedValue({
    message: {
      id: "20000000-0000-4000-8000-000000000001",
      sequence: 2,
      memberId: "member",
      memberDisplayName: "Me",
      memberImage: null,
      content: "Reply",
      createdAt: new Date().toISOString(),
      attachments: [],
      linkPreview: null,
      version: 1,
      reply,
    },
  })
  await value.flush()
  expect(sendChatMessage).toHaveBeenCalledWith(
    "room",
    expect.objectContaining({ replyToId: reply.id, content: "Reply" }),
    expect.any(AbortSignal)
  )
})

it("removes only the departed chat's drafts and pending messages from durable storage", async () => {
  const value = await store()
  value.edit("left", { content: "discard", files: [] })
  await value.enqueue("left")
  value.edit("left", { content: "draft", files: [] })
  value.edit("kept", { content: "keep", files: [] })
  await value.removeRoom("left")
  expect(value.snapshot().drafts).toEqual({
    kept: { content: "keep", files: [] },
  })
  expect(value.snapshot().queue).toEqual([])
  expect(set).toHaveBeenLastCalledWith("member", value.snapshot())
})

it("starts uploading as images are attached, shows progress, and sends once they finish", async () => {
  const value = await store()
  const attachment = uploaded("photo.png")
  let finish: () => void = () => {}
  let report: (sent: number, total: number) => void = () => {}
  vi.mocked(uploadChatImage).mockImplementationOnce(
    (_room, _file, options) =>
      new Promise((resolve) => {
        report = options?.onProgress ?? report
        finish = () => resolve({ attachment })
      })
  )
  vi.mocked(sendChatMessage).mockImplementation(async (_room, input) =>
    sent(input.id, input.attachmentIds)
  )
  const file = { id: "f", name: "photo.png", blob: new Blob(["image"]) }
  value.edit("one", { content: "", files: [file] })
  await vi.waitFor(() =>
    expect(uploadChatImage).toHaveBeenCalledExactlyOnceWith(
      "one",
      { name: "photo.png", blob: file.blob, copy: false },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  )
  report(50, 100)
  expect(value.snapshot().uploads["f"]).toEqual({ sent: 50, total: 100 })
  await value.enqueue("one")
  const sending = value.flush()
  await vi.waitFor(() =>
    expect(value.snapshot().queue[0]?.status).toBe("sending")
  )
  expect(sendChatMessage).not.toHaveBeenCalled()
  finish()
  await sending
  expect(sendChatMessage).toHaveBeenCalledWith(
    "one",
    expect.objectContaining({ attachmentIds: [attachment.id] }),
    expect.any(AbortSignal)
  )
  expect(uploadChatImage).toHaveBeenCalledTimes(1)
  expect(value.snapshot().uploads).toEqual({})
  expect(value.snapshot().queue).toEqual([])
})

it("stops or gives back the uploads of images taken out of a draft", async () => {
  const value = await store()
  const done = uploaded("done.png")
  let signal: AbortSignal | undefined
  vi.mocked(uploadChatImage).mockImplementation(
    async (_room, file, options) => {
      if (file.name === "done.png") return { attachment: done }
      signal = options?.signal
      return new Promise(() => {})
    }
  )
  value.edit("one", {
    content: "",
    files: [
      { id: "done", name: "done.png", blob: new Blob(["a"]) },
      { id: "running", name: "running.png", blob: new Blob(["b"]) },
    ],
  })
  await vi.waitFor(() =>
    expect(value.draft("one").files[0]?.uploaded).toEqual(done)
  )
  value.edit("one", { content: "", files: [] })
  expect(signal?.aborted).toBe(true)
  expect(deleteChatAttachment).toHaveBeenCalledExactlyOnceWith("one", done.id)
  expect(value.snapshot().uploads).toEqual({})
})

it("waits to upload while offline and starts once the chat is online again", async () => {
  vi.stubGlobal("navigator", { onLine: false })
  const value = await store()
  value.edit("one", {
    content: "",
    files: [{ id: "f", name: "photo.png", blob: new Blob(["image"]) }],
  })
  expect(uploadChatImage).not.toHaveBeenCalled()
  vi.stubGlobal("navigator", { onLine: true })
  await value.flush()
  expect(uploadChatImage).toHaveBeenCalledTimes(1)
})

it("leaves a stopped upload until the message is sent, then tries it again", async () => {
  const value = await store()
  vi.mocked(uploadChatImage).mockRejectedValueOnce(new Error("Unavailable"))
  value.edit("one", {
    content: "",
    files: [{ id: "f", name: "photo.png", blob: new Blob(["image"]) }],
  })
  await vi.waitFor(() => expect(value.snapshot().uploads["f"]).toBe("failed"))
  await value.flush()
  expect(uploadChatImage).toHaveBeenCalledTimes(1)
  await value.enqueue("one")
  await value.flush()
  expect(uploadChatImage).toHaveBeenCalledTimes(2)
  expect(sendChatMessage).toHaveBeenCalledTimes(1)
  expect(value.snapshot().uploads).toEqual({})
})

it("uploads expired images again once instead of reporting the send as failed", async () => {
  const value = await store()
  vi.mocked(sendChatMessage)
    .mockRejectedValueOnce(
      new ApiError("expired", 422, "INVALID_CHAT_ATTACHMENTS")
    )
    .mockImplementation(async (_room, input) =>
      sent(input.id, input.attachmentIds)
    )
  value.edit("one", {
    content: "",
    files: [{ id: "f", name: "photo.png", blob: new Blob(["image"]) }],
  })
  await vi.waitFor(() =>
    expect(value.draft("one").files[0]?.uploaded).toBeDefined()
  )
  await value.enqueue("one")
  await value.flush()
  await vi.waitFor(() => expect(value.snapshot().queue).toEqual([]))
  expect(uploadChatImage).toHaveBeenCalledTimes(2)
  expect(sendChatMessage).toHaveBeenCalledTimes(2)
  expect(toast.error).not.toHaveBeenCalled()
})

it("stops a send taken back before its request leaves, without reporting it", async () => {
  const value = await store()
  let finish: () => void = () => {}
  vi.mocked(uploadChatImage).mockImplementationOnce(
    (_room, _file, options) =>
      new Promise((resolve, reject) => {
        finish = () => resolve({ attachment: uploaded("photo.png") })
        options?.signal?.addEventListener("abort", () =>
          reject(new Error("Aborted"))
        )
      })
  )
  const file = { id: "f", name: "photo.png", blob: new Blob(["image"]) }
  value.edit("one", { content: "", files: [file] })
  await value.enqueue("one")
  const flushing = value.flush()
  await vi.waitFor(() =>
    expect(value.snapshot().queue[0]?.status).toBe("sending")
  )
  const [queued] = value.snapshot().queue
  if (!queued) throw Error("Not queued")
  value.cancel(queued.id)
  finish()
  await flushing
  expect(sendChatMessage).not.toHaveBeenCalled()
  expect(value.snapshot().queue).toEqual([])
  expect(toast.error).not.toHaveBeenCalled()
})

it("deletes a message taken back after its request left, once the server has it", async () => {
  const value = await store()
  let answer: (id: string) => void = () => {}
  vi.mocked(sendChatMessage).mockImplementation(
    (_room, input) =>
      new Promise((resolve) => {
        answer = (id) => resolve(sent(id))
        void input
      })
  )
  value.edit("one", { content: "取り消す", files: [] })
  await value.enqueue("one")
  const onSent = vi.fn<() => void>()
  const flushing = value.flush(onSent)
  await vi.waitFor(() => expect(sendChatMessage).toHaveBeenCalledTimes(1))
  const [queued] = value.snapshot().queue
  if (!queued) throw Error("Not queued")
  value.cancel(queued.id)
  expect(value.snapshot().queue).toEqual([])
  answer(queued.id)
  await flushing
  expect(deleteChatMessage).toHaveBeenCalledWith("one", queued.id)
  expect(onSent).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
})

it("gives back an upload the server kept just as its image was taken out", async () => {
  const value = await store()
  const attachment = uploaded("photo.png")
  let finish: () => void = () => {}
  vi.mocked(uploadChatImage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ attachment })
      })
  )
  const file = { id: "f", name: "photo.png", blob: new Blob(["image"]) }
  value.edit("one", { content: "", files: [file] })
  await vi.waitFor(() => expect(uploadChatImage).toHaveBeenCalledTimes(1))
  value.edit("one", { content: "", files: [] })
  finish()
  await vi.waitFor(() =>
    expect(deleteChatAttachment).toHaveBeenCalledWith("one", attachment.id)
  )
  expect(value.draft("one").files).toEqual([])
  expect(value.snapshot().uploads).toEqual({})
})

it("sends a display copy first, then the original once the message is posted", async () => {
  const value = await store()
  const original = new Blob(["original image"], { type: "image/jpeg" })
  const copy = new Blob(["copy"], { type: "image/webp" })
  vi.mocked(displayCopy).mockResolvedValue({
    blob: copy,
    width: 30,
    height: 40,
    copied: true,
  })
  const attachment = { ...uploaded("photo.jpg"), original: false }
  vi.mocked(uploadChatImage).mockResolvedValueOnce({ attachment })
  vi.mocked(sendChatMessage).mockImplementation(async (_room, input) =>
    sent(input.id, input.attachmentIds)
  )
  let arrive: () => void = () => {}
  vi.mocked(uploadChatOriginal).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        arrive = () => resolve(undefined)
      })
  )
  value.edit("one", {
    content: "",
    files: [{ id: "f", name: "photo.jpg", blob: original }],
  })
  await vi.waitFor(() =>
    expect(value.draft("one").files[0]?.uploaded).toBeDefined()
  )
  expect(uploadChatImage).toHaveBeenCalledWith(
    "one",
    { name: "photo.jpg", blob: copy, copy: true },
    expect.anything()
  )
  expect(uploadChatOriginal).not.toHaveBeenCalled()
  await value.enqueue("one")
  await value.flush()
  await vi.waitFor(() =>
    expect(uploadChatOriginal).toHaveBeenCalledWith(
      "one",
      attachment.id,
      expect.objectContaining({ name: "photo.jpg", blob: original })
    )
  )
  expect(value.snapshot().originals).toHaveLength(1)
  arrive()
  await vi.waitFor(() => expect(value.snapshot().originals).toEqual([]))
})

it("keeps an original it could not send for the next chance, and drops one whose image is gone", async () => {
  const pending = (fileId: string) => ({
    fileId,
    roomId: "one",
    attachmentId: crypto.randomUUID(),
    name: `${fileId}.jpg`,
    blob: new Blob([fileId]),
  })
  vi.mocked(get).mockResolvedValue({
    version: 5,
    drafts: {},
    queue: [],
    originals: [pending("a"), pending("b")],
  })
  vi.mocked(uploadChatOriginal)
    .mockRejectedValueOnce(new ApiNetworkError(new Error("offline")))
    .mockRejectedValueOnce(new ApiError("gone", 404, "NOT_FOUND"))
    .mockResolvedValueOnce(undefined)
  const value = await store()
  await vi.waitFor(() => expect(uploadChatOriginal).toHaveBeenCalledTimes(1))
  expect(value.snapshot().originals.map((item) => item.fileId)).toEqual([
    "a",
    "b",
  ])
  await value.flush()
  await vi.waitFor(() => expect(value.snapshot().originals).toEqual([]))
  expect(uploadChatOriginal).toHaveBeenCalledTimes(3)
})

it("lets display copies stand as originals before this device forgets them", async () => {
  const attachmentId = crypto.randomUUID()
  vi.mocked(get).mockResolvedValue({
    version: 5,
    drafts: {},
    queue: [],
    originals: [
      {
        fileId: "x",
        roomId: "one",
        attachmentId,
        name: "x.jpg",
        blob: new Blob(["x"]),
      },
    ],
  })
  vi.mocked(uploadChatOriginal).mockReturnValue(new Promise(() => {}))
  const value = await store()
  await value.giveUpOriginals()
  expect(keepChatImageCopy).toHaveBeenCalledWith("one", attachmentId)
})

it("keeps the chat usable and lets updates go ahead when the saved chat cannot be read", async () => {
  vi.mocked(get).mockRejectedValue(new Error("unreadable"))
  const value = await store()
  expect(value.draft("one")).toEqual({ content: "", files: [] })
  await expect(value.settle()).resolves.toBeUndefined()
  vi.mocked(set).mockRejectedValue(new Error("full"))
  value.edit("one", { content: "書ける", files: [] })
  await expect(value.settle()).resolves.toBeUndefined()
})
