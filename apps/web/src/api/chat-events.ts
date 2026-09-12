import * as v from "valibot"
import {
  chatEventSchema,
  type ChatEvent,
} from "@workspace/shared/communications"
export function subscribeChatEvents(
  onChange: (event: ChatEvent | null) => void
) {
  let socket: WebSocket | null = null,
    timer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    attempts = 0
  const connect = () => {
    const url = new URL("/api/chat/events", location.href)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    socket = new WebSocket(url)
    socket.addEventListener("open", () => {
      if (disposed) return
      attempts = 0
      onChange(null)
    })
    socket.addEventListener("message", (event) => {
      if (disposed) return
      try {
        const parsed = v.safeParse(
          chatEventSchema,
          JSON.parse(String(event.data))
        )
        if (parsed.success) onChange(parsed.output)
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
