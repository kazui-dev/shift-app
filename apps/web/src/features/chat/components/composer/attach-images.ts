import { chatImageLimits } from "@workspace/shared/communications"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatFile } from "@/features/chat/lib/store"

const imageTypes = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/
const imageNames = /\.(heic|heif)$/i
const megabytes = chatImageLimits.bytes / 1024 / 1024

/**
 * Turns picked or dropped files into attachments at once, so the rail fills
 * the moment picking ends. Saving the draft copies the bytes to this device,
 * so a queued send survives the original file being moved or deleted.
 */
export function attachImages(incoming: File[], attached: number): ChatFile[] {
  if (incoming.length + attached > chatImageLimits.count) {
    toast.error("添付できる画像は10枚までです。")
    return []
  }
  const accepted: ChatFile[] = []
  for (const file of incoming) {
    if (!imageTypes.test(file.type) && !imageNames.test(file.name)) {
      toast.error("写真・画像を選択してください。")
      continue
    }
    if (file.size > chatImageLimits.bytes) {
      toast.error(`画像は1枚${megabytes}MBまでです。`)
      continue
    }
    accepted.push({ id: crypto.randomUUID(), name: file.name, blob: file })
  }
  return accepted
}
