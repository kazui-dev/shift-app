import type { ChatAttachment } from "@workspace/shared/communications"
import {
  deleteChatAttachment,
  keepChatImageCopy,
  uploadChatImage,
  uploadChatOriginal,
} from "@/features/chat/api/chat"
import { displayCopy } from "@/features/chat/lib/copy"
import type {
  ChatFile,
  ChatStoreState,
  UploadProgress,
} from "@/features/chat/lib/state"
import { ApiError } from "@/lib/http/client"

type Host = {
  snapshot: () => ChatStoreState
  publish: (state: ChatStoreState) => void
  persist: () => Promise<void>
  active: () => boolean
  sending: () => boolean
}

/** Uploads running at once, so a phone's connection is not split ten ways. */
const concurrentUploads = 3

/** Coordinates image uploads and the originals that follow a sent message. */
export class ChatImageTransfers {
  private host: Host
  private uploading = new Map<
    string,
    { controller: AbortController; promise: Promise<ChatAttachment> }
  >()
  private measuring = false
  private measured = new Set<string>()
  private sendingOriginal = false
  constructor(host: Host) {
    this.host = host
  }
  private get state() {
    return this.host.snapshot()
  }
  private get active() {
    return this.host.active()
  }
  private get running() {
    return this.host.sending()
  }
  private publish(next: ChatStoreState) {
    this.host.publish(next)
  }
  private persist() {
    return this.host.persist()
  }
  stop() {
    for (const { controller } of this.uploading.values()) controller.abort()
    this.uploading.clear()
  }
  abortRoom(roomId: string) {
    for (const { file } of this.files().filter(
      (item) => item.roomId === roomId
    ))
      this.uploading.get(file.id)?.controller.abort()
  }
  /** Lets display copies stand as their originals before sign-out. */
  async giveUpOriginals() {
    await Promise.race([
      Promise.allSettled(
        this.state.originals.map((original) =>
          keepChatImageCopy(original.roomId, original.attachmentId)
        )
      ),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ])
  }
  /**
   * Sends originals of display copies one at a time, only while no image is
   * uploading and no message waits to send, so they never slow what is visible.
   */
  sendOriginals() {
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
  prepare() {
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
  upload(roomId: string, file: ChatFile): Promise<ChatAttachment> {
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
          this.prepare()
          return attachment
        },
        (error: unknown) => {
          this.uploading.delete(file.id)
          if (!controller.signal.aborted) this.setUpload(file.id, "failed")
          this.prepare()
          throw error
        }
      )
    this.uploading.set(file.id, { controller, promise })
    this.setUpload(file.id, { sent: 0, total: current.blob.size })
    return promise
  }
  /** Stops the uploads of images taken out, and gives back those already uploaded. */
  forget(roomId: string, files: readonly ChatFile[]) {
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
}
