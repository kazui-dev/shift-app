import { chatImageLimits } from "@workspace/shared/communications"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatFile } from "@/lib/chat/store"
import { imagePreview } from "@/lib/chat/preview"

const imageTypes = /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/
const imageNames = /\.(heic|heif)$/i
const megabytes = chatImageLimits.bytes / 1024 / 1024

/**
 * Turns picked or dropped files into attachments, reading each one now so a
 * queued send survives the original file being moved or deleted.
 */
export async function attachImages(
  incoming: File[],
  attached: number
): Promise<ChatFile[]> {
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
  const readable = await Promise.all(
    accepted.map(async (selected) => {
      try {
        selected.blob = new Blob([await selected.blob.arrayBuffer()], {
          type: selected.blob.type,
        })
      } catch {
        toast.error("画像を読み込めませんでした。もう一度選択してください。")
        return null
      }
      // The preview made now also serves the rail; HEIC this device cannot
      // decode has no size until the server reads it.
      const preview = await imagePreview(selected.blob)
      if (preview)
        selected.dimensions = { width: preview.width, height: preview.height }
      return selected
    })
  )
  return readable.filter((file) => file !== null)
}
