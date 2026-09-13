import type { ChatImageSize } from "@workspace/shared/communications"
import { getChatImage, getChatOriginal } from "@/api/chat"
import { readCachedImage, storeCachedImage } from "@/lib/chat/image-cache"
import { imagePreview } from "@/lib/chat/preview"

type Loaded<T> = { value: T; bytes: number }
type Entry<T> = {
  promise: Promise<T>
  controller: AbortController
  users: number
  loaded?: Loaded<T>
}
type Held<T> = { promise: Promise<T>; release: () => void }

/**
 * Images kept in memory while in use, least recently used first out once the
 * pool is full. Each kind has its own pool, so large images and originals
 * never push list tiles out.
 */
class ImagePool<T> {
  private entries = new Map<string, Entry<T>>()
  private full: (count: number, bytes: number) => boolean
  private dispose: (value: T) => void
  constructor(
    full: (count: number, bytes: number) => boolean,
    dispose: (value: T) => void = () => undefined
  ) {
    this.full = full
    this.dispose = dispose
  }
  cached(key: string) {
    return this.entries.get(key)?.loaded?.value
  }
  acquire(
    key: string,
    load: (signal: AbortSignal) => Promise<Loaded<T>>
  ): Held<T> {
    let entry = this.entries.get(key)
    if (!entry) {
      const controller = new AbortController()
      const created: Entry<T> = {
        controller,
        users: 0,
        promise: load(controller.signal).then(
          (loaded) => {
            if (controller.signal.aborted) {
              this.dispose(loaded.value)
              throw new Error("Image request was cancelled")
            }
            created.loaded = loaded
            this.trim()
            return loaded.value
          },
          (error: unknown) => {
            if (this.entries.get(key) === created) this.entries.delete(key)
            throw error
          }
        ),
      }
      // Holders handle failures; an evicted load has no holder left to.
      created.promise.catch(() => undefined)
      entry = created
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    entry.users += 1
    const held = entry
    let released = false
    return {
      promise: held.promise,
      release: () => {
        if (released) return
        released = true
        held.users -= 1
        this.trim()
      },
    }
  }
  keep(key: string, loaded: Loaded<T>) {
    if (this.entries.has(key)) {
      this.dispose(loaded.value)
      return
    }
    this.entries.set(key, {
      promise: Promise.resolve(loaded.value),
      controller: new AbortController(),
      users: 0,
      loaded,
    })
    this.trim()
  }
  clear() {
    for (const entry of this.entries.values()) this.evict(entry)
    this.entries.clear()
  }
  private trim() {
    let bytes = 0
    for (const entry of this.entries.values()) bytes += entry.loaded?.bytes ?? 0
    for (const [key, entry] of this.entries) {
      if (!this.full(this.entries.size, bytes)) break
      if (entry.users) continue
      this.evict(entry)
      this.entries.delete(key)
      bytes -= entry.loaded?.bytes ?? 0
    }
  }
  private evict(entry: Entry<T>) {
    entry.controller.abort()
    if (entry.loaded) this.dispose(entry.loaded.value)
  }
}

const megabyte = 1024 * 1024
const revoke = (url: string) => URL.revokeObjectURL(url)
/** List tiles and viewer thumbnails, also kept on this device. */
const tiles = new ImagePool<string>((_, bytes) => bytes > 64 * megabyte, revoke)
/** The viewer's 2400px images. */
const large = new ImagePool<string>((count) => count > 10, revoke)
/** Originals, only while the viewer shows them or their neighbours. */
const originals = new ImagePool<Blob>((count) => count > 0)
/** This device's previews of images it sent, shown until their tiles arrive. */
const sent = new ImagePool<string>((count) => count > 20, revoke)

const keyOf = (...parts: (string | number)[]) => JSON.stringify(parts)

/** An object URL of the image, decoded so showing it never flashes empty. */
async function decoded(blob: Blob): Promise<Loaded<string>> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { value: url, bytes: blob.size }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

export function cachedChatImage(
  user: string,
  room: string,
  id: string,
  size: ChatImageSize
) {
  return (size === 2400 ? large : tiles).cached(keyOf(user, room, id, size))
}

/** Loads a delivered size; list tiles come from this device when it has them. */
export function acquireChatImage(
  user: string,
  room: string,
  id: string,
  size: ChatImageSize
) {
  const key = keyOf(user, room, id, size)
  if (size === 2400)
    return large.acquire(key, async (signal) =>
      decoded(await getChatImage(room, id, size, signal))
    )
  return tiles.acquire(key, async (signal) => {
    const kept = await readCachedImage(user, room, id, size)
    const blob = kept ?? (await getChatImage(room, id, size, signal))
    if (!kept) void storeCachedImage(user, room, id, size, blob)
    return decoded(blob)
  })
}

export function acquireChatOriginal(user: string, room: string, id: string) {
  return originals.acquire(keyOf(user, room, id), async (signal) => {
    const blob = await getChatOriginal(room, id, signal)
    return { value: blob, bytes: blob.size }
  })
}

/** This device's preview of an image it sent, until the image's tile loads. */
export function sentChatImage(user: string, room: string, id: string) {
  return sent.cached(keyOf(user, room, id))
}

/** Keeps the preview of a just-uploaded image to show once its send is confirmed. */
export async function keepSentImage(
  user: string,
  room: string,
  id: string,
  blob: Blob
) {
  try {
    const preview = await imagePreview(blob)
    if (preview) sent.keep(keyOf(user, room, id), await decoded(preview.blob))
  } catch {
    // Without a preview the sent image loads like any other.
  }
}

export function clearChatImages() {
  for (const pool of [tiles, large, originals, sent]) pool.clear()
}
