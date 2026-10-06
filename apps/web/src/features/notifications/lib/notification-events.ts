/** Close only notifications covered by a confirmed server read position. */
export function closeReadNotifications(roomId: string, sequence: number) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return
  navigator.serviceWorker.controller?.postMessage({
    type: "CHAT_READ",
    roomId,
    sequence,
  })
}

/** The callback uses the app router, keeping the existing document alive. */
export function listenNotificationNavigation(
  navigate: (path: string) => Promise<unknown>
) {
  if (!("serviceWorker" in navigator)) return () => undefined
  const onMessage = (event: MessageEvent<unknown>) => {
    const data = event.data
    if (
      event.source !== navigator.serviceWorker.controller ||
      typeof data !== "object" ||
      data === null ||
      !("type" in data) ||
      data.type !== "NOTIFICATION_NAVIGATE" ||
      !("url" in data) ||
      typeof data.url !== "string"
    )
      return
    let target: URL
    try {
      target = new URL(data.url, location.origin)
    } catch {
      return
    }
    if (target.origin !== location.origin) return
    void navigate(target.pathname + target.search + target.hash).then(
      () => event.ports[0]?.postMessage({ ok: true }),
      () => event.ports[0]?.postMessage({ ok: false })
    )
  }
  navigator.serviceWorker.addEventListener("message", onMessage)
  return () => navigator.serviceWorker.removeEventListener("message", onMessage)
}
