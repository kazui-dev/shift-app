import {
  makeDisplayCopy,
  type DisplayCopy,
} from "@/features/chat/lib/copy-encode"

const copies = new WeakMap<Blob, Promise<DisplayCopy | null>>()
let worker: Worker | undefined
/** Set once the worker fails, after which copies are made on the page. */
let workerFailed = false
let nextId = 0
const waiting = new Map<number, (copy: DisplayCopy | null) => void>()

/**
 * The display copy of a picked image, made once per file: sent ahead of the
 * original, shown once the image is sent, and giving the image's size.
 * `null` when this device cannot decode the image.
 */
export function displayCopy(blob: Blob) {
  let copy = copies.get(blob)
  if (!copy) {
    copy = offPage(blob)
    copies.set(blob, copy)
  }
  return copy
}

/** Makes the copy in a worker, so encoding never holds up taps and the rail. */
function offPage(blob: Blob): Promise<DisplayCopy | null> {
  if (typeof Worker === "undefined" || workerFailed)
    return makeDisplayCopy(blob)
  if (!worker) {
    worker = new Worker(new URL("./copy-worker.ts", import.meta.url), {
      type: "module",
    })
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const reply = copyReply(event.data)
      if (!reply) return
      waiting.get(reply.id)?.(reply.copy)
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

function copyReply(
  data: unknown
): { id: number; copy: DisplayCopy | null } | null {
  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data) ||
    typeof data.id !== "number" ||
    !("copy" in data)
  )
    return null
  const { id, copy } = data
  if (copy === null) return { id, copy: null }
  if (
    typeof copy === "object" &&
    "blob" in copy &&
    copy.blob instanceof Blob &&
    "width" in copy &&
    typeof copy.width === "number" &&
    "height" in copy &&
    typeof copy.height === "number" &&
    "copied" in copy &&
    typeof copy.copied === "boolean"
  )
    return {
      id,
      copy: {
        blob: copy.blob,
        width: copy.width,
        height: copy.height,
        copied: copy.copied,
      },
    }
  return null
}
