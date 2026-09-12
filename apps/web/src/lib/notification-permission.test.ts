import { afterEach, expect, it, vi } from "vite-plus/test"
import {
  readNotificationPermission,
  watchNotificationPermission,
} from "./notification-permission"
afterEach(() => vi.unstubAllGlobals())
it("reads the current notification getter", () => {
  const notification: { permission: NotificationPermission } = {
    permission: "denied",
  }
  vi.stubGlobal("Notification", notification)
  expect(readNotificationPermission()).toBe("denied")
  notification.permission = "granted"
  expect(readNotificationPermission()).toBe("granted")
})
it("uses permission events even when Notification.permission disagrees and re-queries on return", async () => {
  const status = Object.assign(new EventTarget(), { state: "denied" })
  const next = Object.assign(new EventTarget(), { state: "granted" })
  const query = vi.fn<() => Promise<typeof status>>().mockResolvedValue(status)
  const browser = new EventTarget()
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" })
  vi.stubGlobal("navigator", { permissions: { query } })
  vi.stubGlobal("Notification", { permission: "granted" })
  vi.stubGlobal("window", browser)
  vi.stubGlobal("document", doc)
  const changed = vi.fn<(permission: NotificationPermission) => void>()
  const stop = watchNotificationPermission(changed)
  await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith("denied"))
  status.state = "prompt"
  status.dispatchEvent(new Event("change"))
  expect(changed).toHaveBeenLastCalledWith("default")
  query.mockResolvedValue(next)
  browser.dispatchEvent(new Event("focus"))
  await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith("granted"))
  next.state = "denied"
  next.dispatchEvent(new Event("change"))
  expect(changed).toHaveBeenLastCalledWith("denied")
  stop()
  changed.mockClear()
  next.dispatchEvent(new Event("change"))
  browser.dispatchEvent(new Event("focus"))
  await Promise.resolve()
  expect(changed).not.toHaveBeenCalled()
})
it("falls back to Notification when Permissions API is unavailable", async () => {
  vi.stubGlobal("navigator", {})
  vi.stubGlobal("Notification", { permission: "denied" })
  vi.stubGlobal("window", new EventTarget())
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" })
  )
  const changed = vi.fn<(permission: NotificationPermission) => void>()
  const stop = watchNotificationPermission(changed)
  await vi.waitFor(() => expect(changed).toHaveBeenCalledWith("denied"))
  stop()
})
