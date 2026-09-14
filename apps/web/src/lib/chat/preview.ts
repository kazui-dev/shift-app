import { scaledCopy, type ImagePreview } from "@/lib/chat/preview-copy"

const previews = new WeakMap<Blob, Promise<ImagePreview | null>>()
let worker: Worker | undefined
/** Set once the worker fails, after which previews are made on the page. */
let workerFailed = false
let nextId = 0
const waiting = new Map<number, (preview: ImagePreview | null) => void>()

/**
 * A copy of a picked image at most 1280px long, made once per file for the
 * sending message and the sent tile, with the original's size. `null` when
 * this device cannot decode the image.
 */
export function imagePreview(blob: Blob) {
  let preview = previews.get(blob)
  if (!preview) {
    preview = offPage(blob)
    previews.set(blob, preview)
  }
  return preview
}

/** Makes the copy in a worker, so decoding never holds up taps and the rail. */
function offPage(blob: Blob): Promise<ImagePreview | null> {
  if (typeof Worker === "undefined" || workerFailed) return scaledCopy(blob)
  if (!worker) {
    worker = new Worker(new URL("./preview-worker.ts", import.meta.url), {
      type: "module",
    })
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const reply = previewReply(event.data)
      if (!reply) return
      waiting.get(reply.id)?.(reply.preview)
      waiting.delete(reply.id)
    })
    worker.addEventListener("error", () => {
      workerFailed = true
      worker = undefined
      for (const resolve of waiting.values()) resolve(null)
      waiting.clear()
    })
  }
  const id = nextId++
  const running = worker
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    running.postMessage({ id, blob })
  })
}

function previewReply(
  data: unknown
): { id: number; preview: ImagePreview | null } | null {
  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data) ||
    typeof data.id !== "number" ||
    !("preview" in data)
  )
    return null
  const { id, preview } = data
  if (preview === null) return { id, preview: null }
  if (
    typeof preview === "object" &&
    "blob" in preview &&
    preview.blob instanceof Blob &&
    "width" in preview &&
    typeof preview.width === "number" &&
    "height" in preview &&
    typeof preview.height === "number"
  )
    return {
      id,
      preview: {
        blob: preview.blob,
        width: preview.width,
        height: preview.height,
      },
    }
  return null
}
