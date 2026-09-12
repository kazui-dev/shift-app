import { afterEach, expect, it, vi } from "vite-plus/test"
import { subscribeChatEvents } from "./chat-events"
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it("refreshes when connected or notified and reconnects without surviving disposal", () => {
  vi.useFakeTimers()
  const sockets: EventTarget[] = []
  class Socket extends EventTarget {
    constructor(url: URL) {
      super()
      expect(url.toString()).toBe("wss://app.example/api/chat/events")
      sockets.push(this)
    }
    close() {
      this.dispatchEvent(new Event("close"))
    }
  }
  vi.stubGlobal("WebSocket", Socket)
  vi.stubGlobal("location", { href: "https://app.example/chat" })
  const changed = vi.fn<() => void>(),
    dispose = subscribeChatEvents(changed)
  sockets[0]?.dispatchEvent(new Event("open"))
  sockets[0]?.dispatchEvent(
    new MessageEvent("message", { data: '{"type":"rooms_changed"}' })
  )
  sockets[0]?.dispatchEvent(new MessageEvent("message", { data: "invalid" }))
  expect(changed).toHaveBeenCalledTimes(2)
  sockets[0]?.dispatchEvent(new Event("close"))
  vi.advanceTimersByTime(2000)
  expect(sockets).toHaveLength(2)
  sockets[1]?.dispatchEvent(new Event("open"))
  expect(changed).toHaveBeenCalledTimes(3)
  dispose()
  vi.advanceTimersByTime(60000)
  expect(sockets).toHaveLength(2)
})
