import * as v from "valibot"
import { toast } from "@workspace/ui/lib/toast"
import { deleteChatMessage, sendChatMessage } from "@/features/chat/api/chat"
import { ApiError, errorMessage } from "@/lib/http/client"

import {
  stateSchema,
  type ChatDraft,
  type ChatStoreState,
  type QueuedMessage,
} from "@/features/chat/lib/state"
import { loadChat, saveChat, clearChat } from "@/features/chat/lib/storage"
import { keepSentImage } from "@/features/chat/lib/images"
import { ChatImageTransfers } from "@/features/chat/lib/image-transfers"
export type { UploadProgress } from "@/features/chat/lib/state"
export type {
  ChatFile,
  ChatDraft,
  QueuedMessage,
} from "@/features/chat/lib/state"

const empty: ChatDraft = { content: "", files: [] }
const stores = new Map<string, ChatStore>()
export class ChatStore {
  private state: ChatStoreState = {
    version: 5,
    drafts: {},
    queue: [],
    originals: [],
    ready: false,
    uploads: {},
  }
  private listeners = new Set<() => void>()
  private writing = Promise.resolve()
  private saved: ChatStoreState | undefined
  private running = false
  private active = true
  private userId: string
  private loading: Promise<void>
  /**
   * The message being sent. Taken back before its request leaves, the send
   * stops; once the request has left, the server may already have it, so the
   * send finishes and the message is deleted.
   */
  private sending:
    | {
        id: string
        controller: AbortController
        requested: boolean
        takenBack: boolean
      }
    | undefined
  /** Messages whose expired uploads were already sent again once. */
  private reuploaded = new Set<string>()
  private transfers = new ChatImageTransfers({
    snapshot: () => this.state,
    publish: (next) => this.publish(next),
    persist: () => this.persist(),
    active: () => this.active,
    sending: () => this.running,
  })
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
  private publish(next: ChatStoreState) {
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
            : { version: 5, drafts: {}, queue: [], originals: [] }),
          ready: true,
          uploads: {},
        })
      if (!parsed.success && this.active) await this.persist()
      this.transfers.prepare()
    } catch (error) {
      // What cannot be restored is not worth blocking the chat or an update
      // for: the chat starts empty and keeps working.
      console.error("Chat restoration failed", error)
      toast.error("保存していた入力内容を復元できませんでした。")
      if (this.active)
        this.publish({
          version: 5,
          drafts: {},
          queue: [],
          originals: [],
          ready: true,
          uploads: {},
        })
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
  /** Finishes pending writes before an app update; an update never waits on anything else. */
  async settle() {
    await this.loading
    await this.persist().catch((error: unknown) => {
      console.error("Chat persistence before update failed", error)
    })
  }
  edit(roomId: string, draft: ChatDraft) {
    const previous = this.draft(roomId).files
    this.publish({
      ...this.state,
      drafts: { ...this.state.drafts, [roomId]: draft },
    })
    const kept = new Set(draft.files.map((file) => file.id))
    this.transfers.forget(
      roomId,
      previous.filter((file) => !kept.has(file.id))
    )
    this.transfers.prepare()
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
    const message = this.state.queue.find((item) => item.id === id)
    if (this.sending?.id === id) {
      this.sending.takenBack = true
      if (!this.sending.requested) this.sending.controller.abort()
    }
    this.publish({
      ...this.state,
      queue: this.state.queue.filter((item) => item.id !== id),
    })
    if (message) this.transfers.forget(message.roomId, message.files)
    void this.persist().catch(() =>
      toast.error("送信待ちを保存できませんでした。")
    )
  }
  async removeRoom(roomId: string) {
    await this.loading
    const drafts = { ...this.state.drafts }
    delete drafts[roomId]
    this.transfers.abortRoom(roomId)
    this.publish({
      ...this.state,
      drafts,
      queue: this.state.queue.filter((item) => item.roomId !== roomId),
      originals: this.state.originals.filter(
        (original) => original.roomId !== roomId
      ),
    })
    await this.persist()
  }
  async giveUpOriginals() {
    await this.loading
    await this.transfers.giveUpOriginals()
  }
  stop() {
    this.active = false
    this.transfers.stop()
    this.listeners.clear()
  }
  async flush(
    onSent?: (
      roomId: string,
      message: Awaited<ReturnType<typeof sendChatMessage>>["message"]
    ) => void
  ) {
    this.transfers.prepare()
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
      const controller = new AbortController()
      const sending = {
        id: message.id,
        controller,
        requested: false,
        takenBack: false,
      }
      this.sending = sending
      this.update(message.id, { status: "sending" })
      try {
        // Uploads began when the images were attached; only unfinished ones are awaited.
        const files = await Promise.all(
          message.files.map(async (file) => ({
            ...file,
            uploaded: await this.transfers.upload(message.roomId, file),
          }))
        )
        if (!this.active) return
        // Made alongside the send, and ready before it is shown as sent, so
        // the sent images never show empty and the send never waits on them.
        const kept = Promise.all(
          files.map((file) =>
            keepSentImage(
              this.userId,
              message.roomId,
              file.uploaded.id,
              file.blob
            )
          )
        )
        this.update(message.id, { files })
        await this.persist()
        if (sending.takenBack) return
        sending.requested = true
        const result = await sendChatMessage(
          message.roomId,
          {
            id: message.id,
            content: message.content,
            ...(message.reply ? { replyToId: message.reply.id } : {}),
            attachmentIds: files.map((file) => file.uploaded.id),
          },
          controller.signal
        )
        await kept
        if (sending.takenBack) {
          await deleteChatMessage(message.roomId, result.message.id).catch(
            () => undefined
          )
          return
        }
        if (!this.active) return
        onSent?.(message.roomId, result.message)
        // Originals of display copies follow once the message is posted.
        const originals = files
          .filter((file) => !file.uploaded.original)
          .map((file) => ({
            fileId: file.id,
            roomId: message.roomId,
            attachmentId: file.uploaded.id,
            name: file.name,
            blob: file.blob,
          }))
        this.publish({
          ...this.state,
          queue: this.state.queue.filter((item) => item.id !== message.id),
          originals: [...this.state.originals, ...originals],
        })
        await this.persist()
      } catch (error) {
        // A message taken back while sending is simply gone.
        if (
          !this.active ||
          !this.state.queue.some((item) => item.id === message.id)
        )
          return
        const expired =
          error instanceof ApiError && error.code === "INVALID_CHAT_ATTACHMENTS"
        // Uploads older than the server keeps are sent again once, not reported.
        const again = expired && !this.reuploaded.has(message.id)
        if (again) this.reuploaded.add(message.id)
        this.update(message.id, {
          status: again || !navigator.onLine ? "waiting" : "failed",
          ...(expired
            ? {
                files: message.files.map((file) => ({
                  id: file.id,
                  name: file.name,
                  blob: file.blob,
                  ...(file.dimensions ? { dimensions: file.dimensions } : {}),
                })),
              }
            : {}),
        })
        await this.persist().catch(() => undefined)
        if (navigator.onLine && !again)
          toast.error(errorMessage(error), { id: `send:${message.id}` })
      }
    } finally {
      this.sending = undefined
      this.running = false
      this.transfers.sendOriginals()
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
  await Promise.all(
    [...stores.values()].map((store) => store.giveUpOriginals())
  )
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
