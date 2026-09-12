self.addEventListener("push", (event) => {
  let data = {}
  try {
    const payload = event.data?.json()
    if (payload && typeof payload === "object") data = payload
  } catch {
    // Every push must produce a visible notification, including invalid payloads.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "旭祭シフト", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: data.data,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const requestedPath = event.notification.data?.url || "/calendar"
  let target
  try {
    target = new URL(requestedPath, self.location.origin)
  } catch {
    return
  }
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      const client =
        clients.find((value) => value.url === target.href) || clients[0]
      if (!client) return self.clients.openWindow(target.href)
      const navigated =
        client.url === target.href ? client : await client.navigate(target.href)
      if (navigated) return navigated.focus()
      return self.clients.openWindow(target.href)
    })()
  )
})
