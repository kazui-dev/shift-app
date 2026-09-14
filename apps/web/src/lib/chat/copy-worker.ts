/// <reference lib="webworker" />
import { makeDisplayCopy } from "@/lib/chat/copy-encode"

declare const self: DedicatedWorkerGlobalScope

// Decodes and encodes picked images here, so the page stays responsive.
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
  void makeDisplayCopy(blob).then((copy) => self.postMessage({ id, copy }))
})
