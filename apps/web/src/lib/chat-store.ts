import * as v from "valibot"
import { toast } from "@workspace/ui/lib/toast"
import { sendChatMessage, uploadChatImage } from "@/api/chat"
import { ApiError, errorMessage } from "@/api/client"

import {
  stateSchema,
  type SavedChat,
  type ChatDraft,
  type QueuedMessage,
} from "./chat-state"
import { loadChat, saveChat, clearChat } from "./chat-storage"
export type { ChatFile, ChatDraft, QueuedMessage } from "./chat-state"
type State = SavedChat & { ready: boolean }
const empty: ChatDraft = { content: "", files: [] }
const stores = new Map<string, ChatStore>()
export class ChatStore {
  private state: State = { version: 4, drafts: {}, queue: [], ready: false }
  private listeners = new Set<() => void>()
  private writing = Promise.resolve()
  private saved: State | undefined
  private running = false
  private active = true
  private userId: string
  private loading: Promise<void>
  constructor(userId: string) {
    this.userId = userId
    this.loading = this.load()
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
      const parsed = v.safeParse(stateSchema, await loadChat(this.userId))
      if (this.active)
        this.publish({
          ...(parsed.success
            ? parsed.output
            : { version: 4, drafts: {}, queue: [] }),
          ready: true,
        })
      if (!parsed.success && this.active) await this.persist()
    } catch (error) {
      console.error("Chat restoration failed", error)
      toast.error("入力内容を復元できません。ページを再読み込みしてください。")
    }
  }
  private persist() {
    const task = this.writing
      .catch(() => undefined)
      .then(async () => {
        const state = this.state
        if (!this.active || state === this.saved) return
        await saveChat(this.userId, state)
        this.saved = state
      })
    this.writing = task
    return task
  }
  async settle() {
    await this.loading
    if (!this.state.ready)
      throw new Error("入力内容を復元できないため、更新を中止しました。")
    await this.persist()
  }
  edit(roomId: string, draft: ChatDraft) {
    this.publish({
      ...this.state,
      drafts: { ...this.state.drafts, [roomId]: draft },
    })
    void this.persist().catch((error: unknown) => {
      toast.error(storageMessage(error), { id: "chat-storage" })
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
    } catch (error) {
      const newer = this.draft(roomId)
      this.publish({
        ...this.state,
        drafts: {
          ...this.state.drafts,
          [roomId]:
            newer === empty
              ? draft
              : {
                  content: [draft.content, newer.content]
                    .filter(Boolean)
                    .join("\n"),
                  files: [...draft.files, ...newer.files],
                  reply: newer.reply ?? draft.reply,
                },
        },
        queue: this.state.queue.filter((item) => item.id !== message.id),
      })
      toast.error(storageMessage(error))
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
  async removeRoom(roomId: string) {
    await this.loading
    const drafts = { ...this.state.drafts }
    delete drafts[roomId]
    this.publish({
      ...this.state,
      drafts,
      queue: this.state.queue.filter((item) => item.roomId !== roomId),
    })
    await this.persist()
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
          ...(message.reply ? { replyToId: message.reply.id } : {}),
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
  await clearChat()
}

export async function settleChatStorage() {
  await Promise.all([...stores.values()].map((store) => store.settle()))
}
function storageMessage(error: unknown) {
  console.error("Chat persistence failed", error)
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "端末の空き容量が足りず、入力内容を保存できません。"
  return "入力内容を端末に保存できません。入力は画面に残っています。"
}
