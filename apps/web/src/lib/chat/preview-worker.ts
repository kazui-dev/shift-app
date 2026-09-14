/// <reference lib="webworker" />
import { scaledCopy } from "@/lib/chat/preview-copy"

declare const self: DedicatedWorkerGlobalScope

// Decodes and scales picked images here, so the page stays responsive.
self.addEventListener("message", (event: MessageEvent<unknown>) => {
  const { data } = event
  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data) ||
    typeof data.id !== "number" ||
    !("blob" in data) ||
    !(data.blob instanceof Blob)
  )
    return
  const { id, blob } = data
  void scaledCopy(blob).then((preview) => self.postMessage({ id, preview }))
})
