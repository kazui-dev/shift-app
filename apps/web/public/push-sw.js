self.addEventListener("push", (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || "旭祭シフト", {
      body: data.body || "",
      icon: "/app-icon.svg",
      badge: "/app-icon.svg",
      tag: data.tag,
      data: data.data,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const requestedPath = event.notification.data?.url || "/timeline"
  const target = new URL(requestedPath, self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("navigate" in client) void client.navigate(target.href)
          if ("focus" in client) return client.focus()
        }
        return self.clients.openWindow(target.href)
      })
  )
})
