import { afterEach, expect, it, vi } from "vite-plus/test"
import {
  readNotificationPermission,
  watchNotificationPermission,
} from "./notification-permission"

afterEach(() => vi.unstubAllGlobals())

it("reads the browser's current notification permission instead of storing a copy", () => {
  const notification: { permission: NotificationPermission } = {
    permission: "denied",
  }
  vi.stubGlobal("Notification", notification)
  expect(readNotificationPermission()).toBe("denied")
  notification.permission = "granted"
  expect(readNotificationPermission()).toBe("granted")
  notification.permission = "denied"
  expect(readNotificationPermission()).toBe("denied")
})

it("observes permission changes and visible app restoration and removes listeners on disposal", async () => {
  const status = new EventTarget(),
    browser = new EventTarget()
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("navigator", { permissions: { query: async () => status } })
  vi.stubGlobal("window", browser)
  vi.stubGlobal("document", doc)
  const changed = vi.fn<() => void>()
  const stop = watchNotificationPermission(changed)
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce())
  status.dispatchEvent(new Event("change"))
  browser.dispatchEvent(new Event("focus"))
  browser.dispatchEvent(new Event("pageshow"))
  doc.dispatchEvent(new Event("visibilitychange"))
  expect(changed).toHaveBeenCalledTimes(5)
  doc.visibilityState = "hidden"
  browser.dispatchEvent(new Event("focus"))
  expect(changed).toHaveBeenCalledTimes(5)
  stop()
  status.dispatchEvent(new Event("change"))
  doc.visibilityState = "visible"
  browser.dispatchEvent(new Event("focus"))
  expect(changed).toHaveBeenCalledTimes(5)
  const disposeEarly = watchNotificationPermission(changed)
  disposeEarly()
  await Promise.resolve()
  await Promise.resolve()
  expect(changed).toHaveBeenCalledTimes(5)
})
