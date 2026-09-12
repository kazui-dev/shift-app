import { clear, createStore, get, set } from "idb-keyval"
import * as v from "valibot"
import { toast } from "@workspace/ui/lib/toast"
import { chatAttachmentSchema } from "@workspace/shared/communications"
import { sendChatMessage, uploadChatImage } from "@/api/chat"
import { ApiError, errorMessage } from "@/api/client"

const fileSchema = v.object({
  id: v.string(),
  name: v.string(),
  blob: v.instance(Blob),
  dimensions: v.optional(
    v.object({
      width: v.pipe(v.number(), v.integer(), v.minValue(1)),
      height: v.pipe(v.number(), v.integer(), v.minValue(1)),
    })
  ),
  uploaded: v.optional(chatAttachmentSchema),
})
const draftSchema = v.object({
  content: v.string(),
  files: v.array(fileSchema),
})
const queuedSchema = v.object({
  id: v.string(),
  roomId: v.string(),
  createdAt: v.string(),
  content: v.string(),
  files: v.array(fileSchema),
  status: v.picklist(["waiting", "sending", "failed"]),
})
const stateSchema = v.object({
  version: v.literal(4),
  drafts: v.record(v.string(), draftSchema),
  queue: v.array(queuedSchema),
})
export type ChatFile = v.InferOutput<typeof fileSchema>
export type ChatDraft = v.InferOutput<typeof draftSchema>
export type QueuedMessage = v.InferOutput<typeof queuedSchema>
type State = v.InferOutput<typeof stateSchema> & { ready: boolean }
const empty: ChatDraft = { content: "", files: [] }
const stores = new Map<string, ChatStore>()
let database: ReturnType<typeof createStore> | undefined
function db() {
  database ??= createStore("shift-chat", "messages")
  return database
}

export class ChatStore {
  private state: State = { version: 4, drafts: {}, queue: [], ready: false }
  private listeners = new Set<() => void>()
  private writing = Promise.resolve()
  private running = false
  private active = true
  private userId: string
  constructor(userId: string) {
    this.userId = userId
    void this.load()
  }
  snapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  draft(roomId: string) {
    return this.state.drafts[roomId] ?? empty
  }
  private publish(next: State) {
    this.state = next
    for (const listener of this.listeners) listener()
  }
  private async load() {
    try {
      const parsed = v.safeParse(
        stateSchema,
        await get<unknown>(this.userId, db())
      )
      if (this.active)
        this.publish({
          ...(parsed.success
            ? parsed.output
            : { version: 4, drafts: {}, queue: [] }),
          ready: true,
        })
      if (!parsed.success && this.active) await this.persist()
    } catch {
      this.publish({ ...this.state, ready: true })
      toast.error("下書きを読み込めませんでした。")
    }
  }
  private persist() {
    const state = this.state
    const task = this.writing
      .catch(() => undefined)
      .then(() =>
        this.active
          ? set(
              this.userId,
              { version: 4, drafts: state.drafts, queue: state.queue },
              db()
            )
          : undefined
      )
    this.writing = task
    return task
  }
  edit(roomId: string, draft: ChatDraft) {
    this.publish({
      ...this.state,
      drafts: { ...this.state.drafts, [roomId]: draft },
    })
    void this.persist().catch(() => {
      toast.error("下書きを保存できませんでした", { id: "chat-storage" })
    })
  }
  async enqueue(roomId: string) {
    const draft = this.draft(roomId)
    if (!this.state.ready || (!draft.content.trim() && !draft.files.length))
      return
    if (this.state.queue.length >= 20) {
      toast.error("送信待ちは20件までです。")
      return
    }
    const message: QueuedMessage = {
      ...draft,
      content: draft.content.trim(),
      id: crypto.randomUUID(),
      roomId,
      status: "waiting",
      createdAt: new Date().toISOString(),
    }
    const drafts = { ...this.state.drafts, [roomId]: empty }
    this.publish({
      ...this.state,
      drafts,
      queue: [...this.state.queue, message],
    })
    try {
      await this.persist()
    } catch {
      this.publish({
        ...this.state,
        drafts: { ...this.state.drafts, [roomId]: draft },
        queue: this.state.queue.filter((item) => item.id !== message.id),
      })
      toast.error("送信内容を端末に保存できませんでした。")
      return
    }
  }
  retry(id: string) {
    this.publish({
      ...this.state,
      queue: this.state.queue.map((item) =>
        item.id === id ? { ...item, status: "waiting" } : item
      ),
    })
    void this.persist()
      .then(() => this.publish({ ...this.state }))
      .catch(() => toast.error("送信待ちを保存できませんでした。"))
  }
  cancel(id: string) {
    this.publish({
      ...this.state,
      queue: this.state.queue.filter((item) => item.id !== id),
    })
    void this.persist().catch(() =>
      toast.error("送信待ちを保存できませんでした。")
    )
  }
  stop() {
    this.active = false
    this.listeners.clear()
  }
  async flush(
    onSent?: (
      roomId: string,
      message: Awaited<ReturnType<typeof sendChatMessage>>["message"]
    ) => void
  ) {
    if (this.running || !this.active || !this.state.ready || !navigator.onLine)
      return
    this.running = true
    try {
      if (
        !(await this.writing.then(
          () => true,
          () => false
        ))
      )
        return
      const message = this.state.queue.find((item) => item.status !== "failed")
      if (!message) return
      this.update(message.id, { status: "sending" })
      try {
        const files = await Promise.all(
          message.files.map(async (file) =>
            file.uploaded
              ? file
              : {
                  ...file,
                  uploaded: (await uploadChatImage(message.roomId, file.blob))
                    .attachment,
                }
          )
        )
        if (!this.active) return
        this.update(message.id, { files })
        await this.persist()
        const result = await sendChatMessage(message.roomId, {
          id: message.id,
          content: message.content,
          attachmentIds: files.flatMap((file) =>
            file.uploaded ? [file.uploaded.id] : []
          ),
        })
        if (!this.active) return
        onSent?.(message.roomId, result.message)
        this.publish({
          ...this.state,
          queue: this.state.queue.filter((item) => item.id !== message.id),
        })
        await this.persist()
      } catch (error) {
        if (!this.active) return
        this.update(message.id, {
          status: navigator.onLine ? "failed" : "waiting",
          ...(error instanceof ApiError &&
          error.code === "INVALID_CHAT_ATTACHMENTS"
            ? {
                files: message.files.map((file) => ({
                  id: file.id,
                  name: file.name,
                  blob: file.blob,
                })),
              }
            : {}),
        })
        await this.persist().catch(() => undefined)
        if (navigator.onLine)
          toast.error(errorMessage(error), { id: `send:${message.id}` })
      }
    } finally {
      this.running = false
    }
    if (
      this.active &&
      navigator.onLine &&
      this.state.queue.some((item) => item.status === "waiting")
    )
      void this.flush(onSent)
  }
  private update(id: string, patch: Partial<QueuedMessage>) {
    this.publish({
      ...this.state,
      queue: this.state.queue.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    })
  }
}
export function chatStore(userId: string) {
  let store = stores.get(userId)
  if (!store) {
    store = new ChatStore(userId)
    stores.set(userId, store)
  }
  return store
}
export async function clearChatStorage() {
  for (const store of stores.values()) store.stop()
  stores.clear()
  await clear(db())
}
