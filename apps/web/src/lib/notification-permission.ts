async function permissionStatus(): Promise<PermissionStatus | null> {
  if (!navigator.permissions) return null
  try {
    return await navigator.permissions.query({ name: "notifications" })
  } catch {
    // Some browsers expose Permissions without supporting notification queries.
    return null
  }
}

export async function readNotificationPermission(): Promise<NotificationPermission> {
  const status = await permissionStatus()
  if (!status) return Notification.permission
  return status.state === "prompt" ? "default" : status.state
}

export function watchNotificationPermission(changed: () => void): () => void {
  let status: PermissionStatus | null = null
  let disposed = false
  const resume = () => {
    if (document.visibilityState === "visible") changed()
  }
  void permissionStatus().then((value) => {
    if (disposed) return
    status = value
    status?.addEventListener("change", changed)
    changed()
  })
  window.addEventListener("focus", resume)
  window.addEventListener("pageshow", resume)
  document.addEventListener("visibilitychange", resume)
  return () => {
    disposed = true
    status?.removeEventListener("change", changed)
    window.removeEventListener("focus", resume)
    window.removeEventListener("pageshow", resume)
    document.removeEventListener("visibilitychange", resume)
  }
}
