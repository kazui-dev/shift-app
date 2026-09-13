import { chatImageLimits } from "@workspace/shared/communications"
import { toast } from "@workspace/ui/lib/toast"
import type { ChatFile } from "@/lib/chat-store"

const imageTypes = /^image\/(jpeg|png|webp|heic|heif|avif)$/
const imageNames = /\.(heic|heif)$/i

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
      toast.error("画像は1枚10MBまでです。")
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
      try {
        const bitmap = await createImageBitmap(selected.blob)
        selected.dimensions = { width: bitmap.width, height: bitmap.height }
        bitmap.close()
      } catch {
        // HEIC can still be decoded by the upload service.
      }
      return selected
    })
  )
  return readable.filter((file) => file !== null)
}
