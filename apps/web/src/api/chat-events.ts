export function subscribeChatEvents(onChange: () => void) {
  let socket: WebSocket | null = null,
    timer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    attempts = 0
  const connect = () => {
    const url = new URL("/api/chat/events", location.href)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    socket = new WebSocket(url)
    socket.addEventListener("open", () => {
      attempts = 0
      onChange()
    })
    socket.addEventListener("message", (event) => {
      try {
        const data: unknown = JSON.parse(String(event.data))
        if (
          typeof data === "object" &&
          data !== null &&
          "type" in data &&
          data.type === "rooms_changed"
        )
          onChange()
      } catch {
        /* Ignore invalid events. */
      }
    })
    socket.addEventListener("close", () => {
      if (!disposed)
        timer = setTimeout(connect, Math.min(30000, 2000 * 2 ** attempts++))
    })
  }
  connect()
  return () => {
    disposed = true
    clearTimeout(timer)
    socket?.close(1000, "Session changed")
  }
}
