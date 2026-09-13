import { storedImageExtensions, type StoredImageType } from "./stored-image"

/** Where an attachment's original lives in the bucket. */
export const chatImageKey = (roomId: string, attachmentId: string) =>
  `${roomId}/${attachmentId}`

/** Cache tags, so deleting an image or its room drops every cached size. */
export const chatImageTag = (attachmentId: string) =>
  `chat-image:${attachmentId}`
export const chatRoomTag = (roomId: string) => `chat-room:${roomId}`

const imageExtension = /\.(jpe?g|png|webp|gif|heic|heif|avif|apng)$/i
/** Characters file systems reserve in names. */
const reservedCharacters = new Set([
  "/",
  "\\",
  ":",
  "*",
  "?",
  '"',
  "<",
  ">",
  "|",
])
const encoder = new TextEncoder()

/** Control characters and those file systems reserve. */
function unsafe(character: string) {
  const code = character.charCodeAt(0)
  return code < 0x20 || code === 0x7f || reservedCharacters.has(character)
}

/**
 * An uploaded name made safe to save as: unsafe characters removed, the
 * extension matching the stored format, at most 255 bytes. Empty when no name
 * remains.
 */
export function attachmentName(value: string, type: StoredImageType) {
  let safe = ""
  for (const character of value) if (!unsafe(character)) safe += character
  const name = safe.trim()
  const match = imageExtension.exec(name)
  const stem = (match ? name.slice(0, match.index) : name).trim()
  if (!stem) return ""
  const current = match?.[1]
  const stored = storedImageExtensions[type]
  const extension = `.${current?.toLowerCase().replace("jpeg", "jpg") === stored ? current : stored}`
  let kept = ""
  for (const character of stem) {
    if (encoder.encode(kept + character + extension).length > 255) break
    kept += character
  }
  return kept + extension
}

/** The name an attachment saves as: its uploaded name, else when it was sent. */
export function attachmentFileName(
  name: string,
  type: StoredImageType,
  sentAt: number
) {
  if (name) return name
  const stamp = new Date(sentAt + 9 * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, "")
    .replace("T", "-")
  return `${stamp}.${storedImageExtensions[type]}`
}
