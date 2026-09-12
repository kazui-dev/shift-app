import { getChatImage } from "@/api/chat"

type Entry = {
  promise: Promise<string>
  controller: AbortController
  users: number
  bytes: number
  url?: string
}
const images = new Map<string, Entry>()
export function cachedChatImage(user: string, room: string, id: string) {
  return images.get(JSON.stringify([user, room, id]))?.url
}
function trim() {
  let bytes = [...images.values()].reduce((sum, item) => sum + item.bytes, 0)
  for (const [key, entry] of images) {
    if (bytes <= 64 * 1024 * 1024 && images.size <= 80) break
    if (entry.users) continue
    entry.controller.abort()
    if (entry.url) URL.revokeObjectURL(entry.url)
    images.delete(key)
    bytes -= entry.bytes
  }
}
export function acquireChatImage(user: string, room: string, id: string) {
  const key = JSON.stringify([user, room, id])
  let entry = images.get(key)
  if (!entry) {
    const controller = new AbortController()
    const created: Entry = {
      controller,
      users: 0,
      bytes: 0,
      promise: Promise.resolve(""),
    }
    created.promise = getChatImage(room, id, controller.signal)
      .then(async (blob) => {
        if (controller.signal.aborted)
          throw new Error("Image request was cancelled")
        const url = URL.createObjectURL(blob)
        created.url = url
        created.bytes = blob.size
        const image = new Image()
        image.src = url
        await image.decode()
        if (controller.signal.aborted)
          throw new Error("Image request was cancelled")
        trim()
        return url
      })
      .catch((error: unknown) => {
        if (created.url) URL.revokeObjectURL(created.url)
        if (images.get(key) === created) images.delete(key)
        throw error
      })
    entry = created
    images.set(key, entry)
  }
  images.delete(key)
  images.set(key, entry)
  entry.users++
  const retained = entry
  return {
    promise: entry.promise,
    release: () => {
      retained.users--
      trim()
    },
  }
}
export function clearChatImages() {
  for (const entry of images.values()) {
    entry.controller.abort()
    if (entry.url) URL.revokeObjectURL(entry.url)
  }
  images.clear()
}
