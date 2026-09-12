import { expect, it, vi } from "vite-plus/test"
import type {
  PushDevice,
  PushDeviceUpdate,
} from "@workspace/shared/communications"
import { PushController } from "./push-controller"

const sub = {
  endpoint: "https://push.example/one",
  expirationTime: null,
  keys: { p256dh: "key", auth: "auth" },
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function setup(enabled = false) {
  let server: PushDevice = {
    id: "11111111-1111-4111-8111-111111111111",
    enabled,
    subscription: enabled ? sub : null,
  }
  const observed: {
    permission: NotificationPermission
    subscription: typeof sub | null
  } = { permission: "granted", subscription: enabled ? sub : null }
  const browser = {
    read: vi.fn<() => Promise<typeof observed>>(async () => ({ ...observed })),
    subscribe: vi.fn<() => Promise<typeof sub>>(async () => sub),
    unsubscribe: vi.fn<() => Promise<void>>(async () => undefined),
  }
  const read = vi.fn<() => Promise<PushDevice>>(async () => server)
  const save = vi.fn<(input: PushDeviceUpdate) => Promise<PushDevice>>(
    async (input) => {
      server = {
        ...server,
        enabled: input.enabled,
        subscription: input.enabled ? input.subscription : server.subscription,
      }
      return server
    }
  )
  const control = new PushController(
    { browser, read, save },
    server,
    () => undefined
  )
  return { control, browser, observed, read, save }
}
it("starts subscribe in the tap call, supports block/off/allow/on, and keeps permission separate", async () => {
  const { control, browser, observed, save } = setup()
  const first = control.setEnabled(true)
  expect(browser.subscribe).toHaveBeenCalledOnce()
  await first
  observed.permission = "denied"
  await control.refresh()
  expect(control.snapshot()).toMatchObject({
    enabled: true,
    permission: "denied",
  })
  await control.setEnabled(false)
  expect(browser.unsubscribe).not.toHaveBeenCalled()
  expect(save).toHaveBeenLastCalledWith({ enabled: false })
  // Both read APIs may still report denied; the browser operation decides.
  await control.setEnabled(true)
  expect(browser.subscribe).toHaveBeenCalledTimes(2)
  expect(control.snapshot()).toMatchObject({ enabled: true, pending: false })
})
it("does not turn ON from a leftover browser subscription or auto-request permission on refresh", async () => {
  const { control, observed, browser, save } = setup()
  observed.subscription = sub
  await control.refresh()
  expect(control.snapshot().enabled).toBe(false)
  expect(browser.subscribe).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})
it("retains an ON preference when a subscription disappears", async () => {
  const { control, observed, browser } = setup(true)
  observed.subscription = null
  observed.permission = "denied"
  await control.refresh()
  expect(control.snapshot().enabled).toBe(true)
  expect(browser.subscribe).not.toHaveBeenCalled()
})
it("repairs changed transport only for a server-enabled device", async () => {
  const { control, observed, save, browser } = setup(true)
  observed.subscription = { ...sub, endpoint: "https://push.example/replaced" }
  await control.refresh()
  expect(save).toHaveBeenCalledWith({
    enabled: true,
    subscription: observed.subscription,
  })
  expect(browser.subscribe).not.toHaveBeenCalled()
})
it("a late permission result cannot undo OFF", async () => {
  const { control, browser, save } = setup()
  const result = deferred<typeof sub>()
  browser.subscribe.mockReturnValueOnce(result.promise)
  const enable = control.setEnabled(true)
  const disable = control.setEnabled(false)
  result.resolve(sub)
  await Promise.all([enable, disable])
  expect(save.mock.calls).toEqual([[{ enabled: false }]])
  expect(control.snapshot()).toMatchObject({ enabled: false, pending: false })
})
it("serializes writes while honoring a change during an in-flight save", async () => {
  const { control, save } = setup()
  const result = deferred<PushDevice>()
  save.mockReturnValueOnce(result.promise)
  const enable = control.setEnabled(true)
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
  const disable = control.setEnabled(false)
  result.resolve({ id: "id", enabled: true, subscription: sub })
  await Promise.all([enable, disable])
  expect(save).toHaveBeenLastCalledWith({ enabled: false })
  expect(control.snapshot().enabled).toBe(false)
})
it("reports the failed stage and rolls back without automatic re-enabling", async () => {
  const { control, save, browser } = setup()
  browser.subscribe.mockRejectedValueOnce(
    new DOMException("denied", "NotAllowedError")
  )
  await expect(control.setEnabled(true)).rejects.toMatchObject({
    stage: "subscribe",
  })
  expect(save).not.toHaveBeenCalled()
  save.mockRejectedValueOnce(new Error("network"))
  await expect(control.setEnabled(true)).rejects.toMatchObject({
    stage: "save",
  })
  await control.refresh()
  expect(control.snapshot().enabled).toBe(false)
  expect(browser.subscribe).toHaveBeenCalledTimes(2)
})
it("does not overwrite a click with an older refresh", async () => {
  const { control, read } = setup()
  const result = deferred<PushDevice>()
  read.mockReturnValueOnce(result.promise)
  const refreshing = control.refresh()
  await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
  const enable = control.setEnabled(true)
  result.resolve({ id: "id", enabled: false, subscription: null })
  await Promise.all([refreshing, enable])
  expect(control.snapshot().enabled).toBe(true)
})
it("discarded account controllers cannot publish or save queued work", async () => {
  const { control, save } = setup()
  const enable = control.setEnabled(true)
  control.dispose()
  await enable
  expect(save).not.toHaveBeenCalled()
})

it("allows an explicit reconnect while the delivery preference remains ON", async () => {
  const { control, observed, browser } = setup(true)
  observed.subscription = null
  await control.refresh()
  expect(control.snapshot()).toMatchObject({
    enabled: true,
    hasSubscription: false,
  })
  await control.setEnabled(true)
  expect(browser.subscribe).toHaveBeenCalledOnce()
  expect(control.snapshot()).toMatchObject({
    enabled: true,
    hasSubscription: true,
  })
})
it("recovers from synchronous browser failures without leaving the control pending", async () => {
  const { control, browser } = setup()
  browser.subscribe.mockImplementationOnce(() => {
    throw new TypeError("invalid")
  })
  await expect(control.setEnabled(true)).rejects.toMatchObject({
    stage: "subscribe",
  })
  expect(control.snapshot()).toMatchObject({ enabled: false, pending: false })
})
