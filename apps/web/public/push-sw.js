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
      icon:
        typeof data.icon === "string" && data.icon
          ? data.icon
          : "/icon-192.png",
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
      await client.focus()
      if (client.url === target.href) return undefined
      const channel = new MessageChannel()
      const handled = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          channel.port1.close()
          resolve(false)
        }, 3000)
        channel.port1.onmessage = (reply) => {
          clearTimeout(timer)
          channel.port1.close()
          resolve(reply.data?.ok === true)
        }
        client.postMessage(
          { type: "NOTIFICATION_NAVIGATE", url: target.href },
          [channel.port2]
        )
      })
      // Older app versions cannot handle this message. Keep their unsaved page.
      if (!handled) return self.clients.openWindow(target.href)
      return undefined
    })()
  )
})

self.addEventListener("message", (event) => {
  const data = event.data
  if (
    data?.type !== "CHAT_READ" ||
    typeof data.roomId !== "string" ||
    !Number.isSafeInteger(data.sequence) ||
    data.sequence < 0
  )
    return
  event.waitUntil(
    (async () => {
      const notifications = await self.registration.getNotifications({
        tag: `chat-${data.roomId}`,
      })
      for (const notification of notifications) {
        const sent = notification.data
        // Old payloads have no sequence: never guess whether they were read.
        if (
          sent?.roomId === data.roomId &&
          Number.isSafeInteger(sent.sequence) &&
          sent.sequence <= data.sequence
        )
          notification.close()
      }
    })()
  )
})
