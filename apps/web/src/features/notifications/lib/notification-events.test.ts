import { afterEach, expect, it, vi } from "vite-plus/test"
import {
  closeReadNotifications,
  listenNotificationNavigation,
} from "./notification-events"

afterEach(() => vi.unstubAllGlobals())

it("routes only controller messages to the same origin", async () => {
  const controller = new MessageChannel().port1
  const serviceWorker = Object.assign(new EventTarget(), { controller })
  vi.stubGlobal("navigator", { serviceWorker })
  vi.stubGlobal("location", { origin: "https://shift.example" })
  const navigate = vi
    .fn<(path: string) => Promise<void>>()
    .mockResolvedValue(undefined)
  const stop = listenNotificationNavigation(navigate)
  const send = (url: string, source: MessagePort | null) =>
    serviceWorker.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "NOTIFICATION_NAVIGATE", url },
        source,
      })
    )
  send("https://other.example/", controller)
  send("/chat/one", null)
  expect(navigate).not.toHaveBeenCalled()
  send("https://shift.example/chat/one?search=x#message", controller)
  await Promise.resolve()
  expect(navigate).toHaveBeenCalledExactlyOnceWith("/chat/one?search=x#message")
  stop()
  send("/calendar", controller)
  expect(navigate).toHaveBeenCalledTimes(1)
  controller.close()
})

it("sends the confirmed room position and tolerates browsers without workers", () => {
  const postMessage = vi.fn<(data: unknown) => void>()
  vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage } } })
  closeReadNotifications("room", 8)
  expect(postMessage).toHaveBeenCalledWith({
    type: "CHAT_READ",
    roomId: "room",
    sequence: 8,
  })
  vi.stubGlobal("navigator", {})
  expect(() => closeReadNotifications("room", 8)).not.toThrow()
})
