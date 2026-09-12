export function readNotificationPermission(): NotificationPermission {
  return Notification.permission
}
export function watchNotificationPermission(
  changed: (permission: NotificationPermission) => void
): () => void {
  let status: PermissionStatus | null = null
  let revision = 0
  let disposed = false
  const report = () => {
    if (status) changed(status.state === "prompt" ? "default" : status.state)
  }
  const refresh = async () => {
    const current = ++revision
    try {
      const next = await navigator.permissions.query({ name: "notifications" })
      if (disposed || current !== revision) return
      status?.removeEventListener("change", report)
      status = next
      status.addEventListener("change", report)
      report()
    } catch {
      if (!disposed && current === revision)
        changed(readNotificationPermission())
    }
  }
  const resume = () => {
    if (document.visibilityState === "visible") void refresh()
  }
  void refresh()
  window.addEventListener("focus", resume)
  window.addEventListener("pageshow", resume)
  document.addEventListener("visibilitychange", resume)
  return () => {
    disposed = true
    status?.removeEventListener("change", report)
    window.removeEventListener("focus", resume)
    window.removeEventListener("pageshow", resume)
    document.removeEventListener("visibilitychange", resume)
  }
}
