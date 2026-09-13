import { get, set, update } from "idb-keyval"

const cacheName = "chat-images-v1"
const indexKey = "chat-image-index-v1"
const day = 86_400_000

const imageCacheLimits = {
  bytes: 200 * 1024 * 1024,
  count: 500,
  age: 14 * day,
}

export type CachedImage = {
  key: string
  user: string
  room: string
  id: string
  bytes: number
  used: number
}
type Index = Record<string, CachedImage>

const keyOf = (user: string, room: string, id: string) =>
  `/__chat-image/${encodeURIComponent(user)}/${room}/${id}`

/**
 * Entries to drop: anything unused for longer than the age limit, then the
 * least recently used once the rest would exceed the size or count limit.
 */
export function staleImages(
  entries: readonly CachedImage[],
  now: number,
  limits = imageCacheLimits
): string[] {
  const stale: string[] = []
  const fresh: CachedImage[] = []
  for (const entry of entries)
    if (now - entry.used > limits.age) stale.push(entry.key)
    else fresh.push(entry)
  let bytes = 0
  let count = 0
  for (const entry of fresh.toSorted((a, b) => b.used - a.used)) {
    bytes += entry.bytes
    count += 1
    if (bytes > limits.bytes || count > limits.count) stale.push(entry.key)
  }
  return stale
}

/** A previously shown image, if this device still keeps it. */
export async function readCachedImage(user: string, room: string, id: string) {
  const key = keyOf(user, room, id)
  try {
    const response = await (await caches.open(cacheName)).match(key)
    if (!response) return undefined
    void update<Index>(indexKey, (index = {}) => {
      const entry = index[key]
      return entry ? { ...index, [key]: { ...entry, used: Date.now() } } : index
    }).catch(() => undefined)
    return await response.blob()
  } catch {
    return undefined
  }
}

export async function storeCachedImage(
  user: string,
  room: string,
  id: string,
  blob: Blob
) {
  const key = keyOf(user, room, id)
  try {
    await (
      await caches.open(cacheName)
    ).put(key, new Response(blob, { headers: { "Content-Type": blob.type } }))
    await update<Index>(indexKey, (index = {}) => ({
      ...index,
      [key]: { key, user, room, id, bytes: blob.size, used: Date.now() },
    }))
    await pruneCachedImages()
  } catch {
    // Full or unavailable storage: fall back to the network for every image.
    await clearCachedImages()
  }
}

async function forget(select: (entry: CachedImage) => boolean) {
  try {
    const index = (await get<Index>(indexKey)) ?? {}
    const dropped = Object.values(index).filter(select)
    if (!dropped.length) return
    const cache = await caches.open(cacheName)
    await Promise.all(dropped.map((entry) => cache.delete(entry.key)))
    const keys = new Set(dropped.map((entry) => entry.key))
    await update<Index>(indexKey, (current = {}) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !keys.has(key))
      )
    )
  } catch {
    // Storage is unavailable; nothing is kept to forget.
  }
}

export async function pruneCachedImages(now = Date.now()) {
  try {
    const index = (await get<Index>(indexKey)) ?? {}
    const stale = new Set(staleImages(Object.values(index), now))
    await forget((entry) => stale.has(entry.key))
  } catch {
    // Storage is unavailable; nothing is kept to prune.
  }
}

export const forgetRoomImages = (room: string) =>
  forget((entry) => entry.room === room)

export const forgetImages = (room: string, ids: readonly string[]) =>
  forget((entry) => entry.room === room && ids.includes(entry.id))

export async function clearCachedImages() {
  try {
    await caches.delete(cacheName)
    await set(indexKey, {})
  } catch {
    // Storage is unavailable; nothing is kept to clear.
  }
}
