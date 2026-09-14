import type { ChatImageSize } from "@workspace/shared/communications"
import { getChatImage, getChatLinkImage, getChatOriginal } from "@/api/chat"
import { readCachedImage, storeCachedImage } from "@/lib/chat/image-cache"
import { displayCopy } from "@/lib/chat/copy"

type Loaded<T> = { value: T; bytes: number }
type Entry<T> = {
  promise: Promise<T>
  controller: AbortController
  users: number
  loaded?: Loaded<T>
}
/** An image in use; release it once it is no longer needed. */
export type HeldImage<T> = { promise: Promise<T>; release: () => void }

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
  ): HeldImage<T> {
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
/** List tiles, viewer thumbnails and link card images, also kept on this device. */
const tiles = new ImagePool<string>((_, bytes) => bytes > 64 * megabyte, revoke)
/** The viewer's 2400px images. */
const large = new ImagePool<string>((count) => count > 10, revoke)
/** Originals, only while the viewer shows them or their neighbours. */
const originals = new ImagePool<Blob>((count) => count > 0)
/** This device's previews of images it sent, shown until their tiles arrive. */
const sent = new ImagePool<string>((count) => count > 20, revoke)

const keyOf = (...parts: (string | number)[]) => JSON.stringify(parts)
/** One key for storing and finding a small image, so a kept one is always found. */
const tileKey = (user: string, room: string, id: string, variant: string) =>
  keyOf(user, room, id, variant)

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
  return size === 2400
    ? large.cached(keyOf(user, room, id, size))
    : tiles.cached(tileKey(user, room, id, String(size)))
}

/** A small image from this device when it keeps one, else fetched and kept. */
function acquireKept(
  user: string,
  room: string,
  id: string,
  variant: string,
  fetchImage: (signal: AbortSignal) => Promise<Blob>
) {
  return tiles.acquire(tileKey(user, room, id, variant), async (signal) => {
    const kept = await readCachedImage(user, room, id, variant)
    const blob = kept ?? (await fetchImage(signal))
    if (!kept) void storeCachedImage(user, room, id, variant, blob)
    return decoded(blob)
  })
}

/** Loads a delivered size; list tiles come from this device when it has them. */
export function acquireChatImage(
  user: string,
  room: string,
  id: string,
  size: ChatImageSize
) {
  if (size === 2400)
    return large.acquire(keyOf(user, room, id, size), async (signal) =>
      decoded(await getChatImage(room, id, size, signal))
    )
  return acquireKept(user, room, id, String(size), (signal) =>
    getChatImage(room, id, size, signal)
  )
}

const linkVariant = (url: string) => `link:${url}`

export function cachedLinkImage(
  user: string,
  room: string,
  messageId: string,
  url: string
) {
  return tiles.cached(tileKey(user, room, messageId, linkVariant(url)))
}

/** A message's link card image, kept on this device like list tiles. */
export function acquireLinkImage(
  user: string,
  room: string,
  messageId: string,
  url: string
) {
  return acquireKept(user, room, messageId, linkVariant(url), (signal) =>
    getChatLinkImage(room, messageId, signal)
  )
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

/** Keeps the display copy of a just-uploaded image to show once its send is confirmed. */
export async function keepSentImage(
  user: string,
  room: string,
  id: string,
  blob: Blob
) {
  try {
    const copy = await displayCopy(blob)
    if (copy) sent.keep(keyOf(user, room, id), await decoded(copy.blob))
  } catch {
    // Without a preview the sent image loads like any other.
  }
}

/** Loads an image ahead of use, into memory and this device, without keeping it. */
export function warmImage(image: HeldImage<unknown>) {
  void image.promise.catch(() => undefined).finally(image.release)
}

export function clearChatImages() {
  for (const pool of [tiles, large, originals, sent]) pool.clear()
}
