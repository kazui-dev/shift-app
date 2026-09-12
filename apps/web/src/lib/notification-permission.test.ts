import { afterEach, expect, it, vi } from "vite-plus/test"
import {
  readNotificationPermission,
  watchNotificationPermission,
} from "./notification-permission"

afterEach(() => vi.unstubAllGlobals())

it("queries permission afresh and falls back when notification queries are unsupported", async () => {
  vi.stubGlobal("Notification", { permission: "denied" })
  const query = vi
    .fn<() => Promise<{ state: PermissionState }>>()
    .mockResolvedValue({ state: "granted" })
  vi.stubGlobal("navigator", { permissions: { query } })
  expect(await readNotificationPermission()).toBe("granted")
  query.mockResolvedValue({ state: "prompt" })
  expect(await readNotificationPermission()).toBe("default")
  query.mockResolvedValue({ state: "denied" })
  expect(await readNotificationPermission()).toBe("denied")
  query.mockRejectedValue(new TypeError("unsupported"))
  expect(await readNotificationPermission()).toBe("denied")
  vi.stubGlobal("navigator", {})
  expect(await readNotificationPermission()).toBe("denied")
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
