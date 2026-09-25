import * as v from "valibot"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatAttachment } from "@workspace/shared/communications"
import {
  deleteChatAttachment,
  deleteChatMessage,
  keepChatImageCopy,
  sendChatMessage,
  uploadChatImage,
  uploadChatOriginal,
} from "@/features/chat/api/chat"
import { ApiError, errorMessage } from "@/lib/http/client"

import {
  stateSchema,
  type ChatFile,
  type SavedChat,
  type ChatDraft,
  type QueuedMessage,
} from "@/features/chat/lib/state"
import { loadChat, saveChat, clearChat } from "@/features/chat/lib/storage"
import { keepSentImage } from "@/features/chat/lib/images"
import { displayCopy } from "@/features/chat/lib/copy"
export type {
  ChatFile,
  ChatDraft,
  QueuedMessage,
} from "@/features/chat/lib/state"

/** How far an image's upload has gone, or that it stopped; absent once uploaded. */
export type UploadProgress = { sent: number; total: number } | "failed"
type State = SavedChat & {
  ready: boolean
  uploads: Record<string, UploadProgress>
}
const empty: ChatDraft = { content: "", files: [] }
/** Uploads running at once, so a phone's connection is not split ten ways. */
const concurrentUploads = 3
const stores = new Map<string, ChatStore>()
export class ChatStore {
  private state: State = {
    version: 5,
    drafts: {},
    queue: [],
    originals: [],
    ready: false,
    uploads: {},
  }
  private listeners = new Set<() => void>()
  private writing = Promise.resolve()
  private saved: State | undefined
  private running = false
  private active = true
  private userId: string
  private loading: Promise<void>
  private uploading = new Map<
    string,
    { controller: AbortController; promise: Promise<ChatAttachment> }
  >()
  private measuring = false
  private measured = new Set<string>()
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
  /** Whether an original is on its way, so originals go one at a time. */
  private sendingOriginal = false
  /** Messages whose expired uploads were already sent again once. */
  private reuploaded = new Set<string>()
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
            : { version: 5, drafts: {}, queue: [], originals: [] }),
          ready: true,
          uploads: {},
        })
      if (!parsed.success && this.active) await this.persist()
      this.prepareFiles()
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
    this.forget(
      roomId,
      previous.filter((file) => !kept.has(file.id))
    )
    this.prepareFiles()
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
    if (message) this.forget(message.roomId, message.files)
    void this.persist().catch(() =>
      toast.error("送信待ちを保存できませんでした。")
    )
  }
  async removeRoom(roomId: string) {
    await this.loading
    const drafts = { ...this.state.drafts }
    delete drafts[roomId]
    for (const { file } of this.files().filter(
      (item) => item.roomId === roomId
    ))
      this.uploading.get(file.id)?.controller.abort()
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
  /**
   * Lets display copies stand as their originals before this device forgets
   * the originals, as at sign-out. Best effort, and never longer than 3s.
   */
  async giveUpOriginals() {
    await this.loading
    await Promise.race([
      Promise.allSettled(
        this.state.originals.map((original) =>
          keepChatImageCopy(original.roomId, original.attachmentId)
        )
      ),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ])
  }
  stop() {
    this.active = false
    for (const { controller } of this.uploading.values()) controller.abort()
    this.uploading.clear()
    this.listeners.clear()
  }
  async flush(
    onSent?: (
      roomId: string,
      message: Awaited<ReturnType<typeof sendChatMessage>>["message"]
    ) => void
  ) {
    this.prepareFiles()
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
            uploaded: await this.upload(message.roomId, file),
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
      this.sendOriginals()
    }
    if (
      this.active &&
      navigator.onLine &&
      this.state.queue.some((item) => item.status === "waiting")
    )
      void this.flush(onSent)
  }
  /**
   * Sends originals of display copies one at a time, only while no image is
   * uploading and no message waits to send, so they never slow what is visible.
   */
  private sendOriginals() {
    if (
      this.sendingOriginal ||
      this.running ||
      this.uploading.size ||
      this.state.queue.some((item) => item.status !== "failed") ||
      !this.active ||
      !this.state.ready ||
      !navigator.onLine
    )
      return
    const next = this.state.originals[0]
    if (!next) return
    this.sendingOriginal = true
    void uploadChatOriginal(next.roomId, next.attachmentId, next)
      .then(
        () => true,
        // Only an image that is gone or cannot be read as an image is given
        // up; any other failure keeps the original for the next chance.
        (error: unknown) =>
          error instanceof ApiError &&
          (error.status === 404 || error.status === 422)
      )
      .then((done) => {
        this.sendingOriginal = false
        if (!done || !this.active) return
        this.publish({
          ...this.state,
          originals: this.state.originals.filter(
            (original) => original.fileId !== next.fileId
          ),
        })
        void this.persist().catch(() => undefined)
        this.sendOriginals()
      })
  }
  /** Every drafted and queued image, with the room it goes to. */
  private files() {
    return [
      ...Object.entries(this.state.drafts).flatMap(([roomId, draft]) =>
        draft.files.map((file) => ({ roomId, file }))
      ),
      ...this.state.queue.flatMap((message) =>
        message.files.map((file) => ({ roomId: message.roomId, file }))
      ),
    ]
  }
  /** Starts sizing and uploading attached images that still need it. */
  private prepareFiles() {
    if (!this.active || !this.state.ready) return
    this.measure()
    if (!navigator.onLine) return
    for (const { roomId, file } of this.files()) {
      if (this.uploading.size >= concurrentUploads) break
      if (
        !file.uploaded &&
        !this.uploading.has(file.id) &&
        this.state.uploads[file.id] !== "failed"
      )
        void this.upload(roomId, file).catch(() => undefined)
    }
    this.sendOriginals()
  }
  /** An image's upload, joining the one already running for it. */
  private upload(roomId: string, file: ChatFile): Promise<ChatAttachment> {
    const current =
      this.files().find((item) => item.file.id === file.id)?.file ?? file
    if (current.uploaded) return Promise.resolve(current.uploaded)
    const running = this.uploading.get(file.id)
    if (running) return running.promise
    const controller = new AbortController()
    let reported = -1
    // A display copy goes first when it is much smaller; its original follows the message.
    const promise = displayCopy(current.blob)
      .then((made) => {
        if (controller.signal.aborted)
          throw new DOMException("Aborted", "AbortError")
        const copy = made?.copied ? made.blob : null
        return uploadChatImage(
          roomId,
          { name: current.name, blob: copy ?? current.blob, copy: !!copy },
          {
            signal: controller.signal,
            onProgress: (sent, total) => {
              // Whole percents only, so progress never floods the chat with renders.
              const percent = Math.floor((sent / total) * 100)
              if (percent === reported || !this.uploading.has(file.id)) return
              reported = percent
              this.setUpload(file.id, { sent, total })
            },
          }
        )
      })
      .then(
        ({ attachment }) => {
          this.uploading.delete(file.id)
          if (controller.signal.aborted) {
            // Taken out just as the server kept it, so it is given back.
            void deleteChatAttachment(roomId, attachment.id).catch(
              () => undefined
            )
            throw new DOMException("Aborted", "AbortError")
          }
          this.setUpload(file.id, undefined)
          this.updateFile(file.id, { uploaded: attachment })
          void this.persist().catch(() => undefined)
          this.prepareFiles()
          return attachment
        },
        (error: unknown) => {
          this.uploading.delete(file.id)
          if (!controller.signal.aborted) this.setUpload(file.id, "failed")
          this.prepareFiles()
          throw error
        }
      )
    this.uploading.set(file.id, { controller, promise })
    this.setUpload(file.id, { sent: 0, total: current.blob.size })
    return promise
  }
  /** Stops the uploads of images taken out, and gives back those already uploaded. */
  private forget(roomId: string, files: readonly ChatFile[]) {
    for (const file of files) {
      this.uploading.get(file.id)?.controller.abort()
      this.uploading.delete(file.id)
      this.setUpload(file.id, undefined)
      if (file.uploaded)
        void deleteChatAttachment(roomId, file.uploaded.id).catch(
          () => undefined
        )
    }
  }
  /** Makes attached images' display copies one at a time, reading their sizes for the frames they are sent in. */
  private measure() {
    if (this.measuring || !this.active) return
    const next = this.files().find(
      ({ file }) =>
        !file.dimensions && !file.uploaded && !this.measured.has(file.id)
    )
    if (!next) return
    this.measuring = true
    this.measured.add(next.file.id)
    void displayCopy(next.file.blob)
      .then((copy) => {
        if (copy)
          this.updateFile(next.file.id, {
            dimensions: { width: copy.width, height: copy.height },
          })
      })
      .finally(() => {
        this.measuring = false
        this.measure()
      })
  }
  private setUpload(fileId: string, progress: UploadProgress | undefined) {
    if (!progress && !(fileId in this.state.uploads)) return
    const uploads = { ...this.state.uploads }
    if (progress) uploads[fileId] = progress
    else delete uploads[fileId]
    this.publish({ ...this.state, uploads })
  }
  private updateFile(fileId: string, patch: Partial<ChatFile>) {
    const change = (files: ChatFile[]) =>
      files.some((file) => file.id === fileId)
        ? files.map((file) =>
            file.id === fileId ? { ...file, ...patch } : file
          )
        : files
    this.publish({
      ...this.state,
      drafts: Object.fromEntries(
        Object.entries(this.state.drafts).map(([roomId, draft]) => [
          roomId,
          { ...draft, files: change(draft.files) },
        ])
      ),
      queue: this.state.queue.map((message) => ({
        ...message,
        files: change(message.files),
      })),
    })
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
