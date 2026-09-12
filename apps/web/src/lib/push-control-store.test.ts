import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test"
import {
  getNotificationDevices,
  saveNotificationPreference,
  saveDeviceSubscription,
} from "@/api/push"
import { readPushSubscription, subscribePush } from "./push-browser"
import { watchNotificationPermission } from "./notification-permission"
import {
  getPushControlState,
  preparePushControl,
  resetPushControl,
  setPushEnabled,
  subscribePushControl,
} from "./push-control-store"
vi.mock("@/api/push", () => ({
  getNotificationDevices: vi.fn<typeof getNotificationDevices>(),
  saveNotificationPreference: vi.fn<typeof saveNotificationPreference>(),
  saveDeviceSubscription: vi.fn<typeof saveDeviceSubscription>(),
}))
vi.mock("./push-browser", () => ({
  pushSupported: () => true,
  readPushSubscription: vi.fn<typeof readPushSubscription>(),
  subscribePush: vi.fn<typeof subscribePush>(),
}))
vi.mock("./notification-permission", () => ({
  watchNotificationPermission: vi.fn<typeof watchNotificationPermission>(),
}))
const sub = {
  endpoint: "https://push.example/1",
  expirationTime: null,
  keys: { p256dh: "key", auth: "auth" },
}
const request = vi.fn<typeof Notification.requestPermission>()
beforeEach(() => {
  resetPushControl()
  vi.resetAllMocks()
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: request,
  })
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} })
  vi.mocked(getNotificationDevices).mockResolvedValue([])
  vi.mocked(readPushSubscription).mockResolvedValue(null)
  vi.mocked(subscribePush).mockResolvedValue(sub)
  request.mockResolvedValue("granted")
})
afterEach(() => {
  resetPushControl()
  vi.unstubAllGlobals()
})
it("observes permission before startup I/O finishes and does not prompt", async () => {
  let finish: (value: []) => void = () => {}
  vi.mocked(getNotificationDevices).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const initial = preparePushControl("member")
  expect(watchNotificationPermission).toHaveBeenCalledOnce()
  expect(getPushControlState().enabled).toBeNull()
  finish([])
  await initial
  expect(request).not.toHaveBeenCalled()
})
it.each(["denied", "default"] as const)(
  "returns to OFF without an error when permission returns %s",
  async (result) => {
    request.mockResolvedValue(result)
    await preparePushControl("member")
    const saving = setPushEnabled(true)
    expect(getPushControlState().enabled).toBe(true)
    expect(request).toHaveBeenCalledOnce()
    await saving
    expect(saveNotificationPreference).toHaveBeenCalledWith(
      expect.any(String),
      false
    )
    expect(getPushControlState().enabled).toBe(false)
    expect(subscribePush).not.toHaveBeenCalled()
    expect(getPushControlState().error).toBeNull()
  }
)
it("permission changes in either direction never change the saved preference", async () => {
  await preparePushControl("member")
  await setPushEnabled(true)
  const observe = vi.mocked(watchNotificationPermission).mock.calls[0]?.[0]
  observe?.("granted")
  expect(getPushControlState().enabled).toBe(true)
  observe?.("denied")
  expect(getPushControlState().enabled).toBe(true)
  await setPushEnabled(false)
  observe?.("granted")
  expect(getPushControlState().enabled).toBe(false)
  expect(saveNotificationPreference).toHaveBeenCalledTimes(2)
})
it("OFF neither requests permission nor removes the browser subscription", async () => {
  await preparePushControl("member")
  await setPushEnabled(false)
  expect(request).not.toHaveBeenCalled()
  expect(subscribePush).not.toHaveBeenCalled()
  expect(saveNotificationPreference).toHaveBeenCalledWith(
    expect.any(String),
    false
  )
})
it("serializes rapid preference changes without delaying the switch", async () => {
  await preparePushControl("member")
  let finish: () => void = () => {}
  vi.mocked(saveNotificationPreference).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const on = setPushEnabled(true)
  const off = setPushEnabled(false)
  expect(getPushControlState().enabled).toBe(false)
  await vi.waitFor(() =>
    expect(saveNotificationPreference).toHaveBeenCalledTimes(1)
  )
  finish()
  await Promise.all([on, off])
  expect(
    vi.mocked(saveNotificationPreference).mock.calls.map((call) => call[1])
  ).toEqual([true, false])
})
it("rolls back only a failed preference save, not a rejected permission", async () => {
  await preparePushControl("member")
  vi.mocked(saveNotificationPreference).mockRejectedValueOnce(
    new Error("network")
  )
  await setPushEnabled(true)
  expect(getPushControlState()).toMatchObject({
    enabled: false,
    error: "通知設定を保存できませんでした",
  })
  await setPushEnabled(true)
  expect(getPushControlState()).toMatchObject({ enabled: true, error: null })
  expect(saveNotificationPreference).toHaveBeenCalledTimes(2)
})
it("starts OFF when blocked without publishing the saved ON first", async () => {
  vi.stubGlobal("Notification", {
    permission: "denied",
    requestPermission: request,
  })
  vi.mocked(readPushSubscription).mockResolvedValue({
    ...sub,
    options: { userVisibleOnly: true, applicationServerKey: null },
    getKey: () => null,
    toJSON: () => sub,
    unsubscribe: async () => true,
  })
  vi.mocked(getNotificationDevices).mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-000000000000",
      enabled: true,
      endpoint: sub.endpoint,
    },
  ])
  const states: (boolean | null)[] = []
  const stop = subscribePushControl(() =>
    states.push(getPushControlState().enabled)
  )
  await preparePushControl("member")
  stop()
  expect(states).not.toContain(true)
  expect(saveNotificationPreference).toHaveBeenCalledWith(
    "00000000-0000-4000-8000-000000000000",
    false
  )
  expect(getPushControlState()).toMatchObject({
    enabled: false,
  })
  expect(request).not.toHaveBeenCalled()
})

it("returns OFF without an error when the permission request rejects", async () => {
  request.mockRejectedValue(new DOMException("blocked", "NotAllowedError"))
  await preparePushControl("member")
  await setPushEnabled(true)
  expect(getPushControlState()).toMatchObject({ enabled: false, error: null })
  expect(subscribePush).not.toHaveBeenCalled()
})
it.each(["NotAllowedError", "SecurityError"])(
  "turns OFF for permission-related subscription errors: %s",
  async (name) => {
    request.mockResolvedValue("granted")
    vi.mocked(subscribePush).mockRejectedValue(
      new DOMException("blocked", name)
    )
    await preparePushControl("member")
    await setPushEnabled(true)
    await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledOnce())
    await vi.waitFor(() =>
      expect(getPushControlState()).toMatchObject({
        enabled: false,
        error: null,
      })
    )
    await vi.waitFor(() =>
      expect(saveNotificationPreference).toHaveBeenLastCalledWith(
        expect.any(String),
        false
      )
    )
  }
)
it.each(["browser", "server"])(
  "reports %s registration failures without reverting ON",
  async (source) => {
    request.mockResolvedValue("granted")
    if (source === "browser")
      vi.mocked(subscribePush).mockRejectedValue(new Error("network"))
    else
      vi.mocked(saveDeviceSubscription).mockRejectedValue(new Error("network"))
    await preparePushControl("member")
    await setPushEnabled(true)
    await vi.waitFor(() =>
      expect(getPushControlState()).toMatchObject({
        enabled: true,
        error: "通知の登録に失敗しました",
      })
    )
  }
)

it("can enable again after a dismissed prompt", async () => {
  request.mockResolvedValueOnce("default").mockResolvedValueOnce("granted")
  await preparePushControl("member")
  await setPushEnabled(true)
  expect(getPushControlState().enabled).toBe(false)
  await setPushEnabled(true)
  expect(getPushControlState().enabled).toBe(true)
  expect(request).toHaveBeenCalledTimes(2)
})
it("shares a pending prompt and preserves the latest ON/OFF intent", async () => {
  let finish: (permission: NotificationPermission) => void = () => {}
  request.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await preparePushControl("member")
  const on = setPushEnabled(true)
  const off = setPushEnabled(false)
  const again = setPushEnabled(true)
  expect(request).toHaveBeenCalledOnce()
  finish("granted")
  await Promise.all([on, off, again])
  expect(getPushControlState().enabled).toBe(true)
  expect(
    vi.mocked(saveNotificationPreference).mock.calls.map((call) => call[1])
  ).toEqual([true, false, true])
})

it("requests on each ON even if cached permission remains granted", async () => {
  vi.stubGlobal("Notification", {
    permission: "granted",
    requestPermission: request,
  })
  request.mockResolvedValueOnce("granted").mockResolvedValueOnce("denied")
  await preparePushControl("member")
  await setPushEnabled(true)
  expect(request).toHaveBeenCalledTimes(1)
  expect(getPushControlState().enabled).toBe(true)
  await setPushEnabled(false)
  expect(request).toHaveBeenCalledTimes(1)
  await setPushEnabled(true)
  expect(request).toHaveBeenCalledTimes(2)
  expect(getPushControlState().enabled).toBe(false)
})

it("keeps OFF if saving a permission rejection fails", async () => {
  await preparePushControl("member")
  await setPushEnabled(true)
  await vi.waitFor(() => expect(saveDeviceSubscription).toHaveBeenCalledOnce())
  request.mockResolvedValue("denied")
  vi.mocked(saveNotificationPreference).mockRejectedValueOnce(
    new Error("network")
  )
  await setPushEnabled(true)
  expect(getPushControlState()).toMatchObject({
    enabled: false,
    error: "通知設定を保存できませんでした",
  })
})
it("does not let an old subscription rejection undo a newer ON", async () => {
  let reject: (error: Error) => void = () => {}
  vi.mocked(subscribePush).mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail
    })
  )
  await preparePushControl("member")
  await setPushEnabled(true)
  await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledOnce())
  await setPushEnabled(false)
  await setPushEnabled(true)
  reject(new DOMException("blocked", "NotAllowedError"))
  await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledTimes(2))
  expect(getPushControlState()).toMatchObject({ enabled: true, error: null })
})

it("keeps OFF and reports a failed save after subscription permission denial", async () => {
  vi.mocked(subscribePush).mockRejectedValue(
    new DOMException("blocked", "NotAllowedError")
  )
  vi.mocked(saveNotificationPreference)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("network"))
  await preparePushControl("member")
  await setPushEnabled(true)
  await vi.waitFor(() =>
    expect(getPushControlState()).toMatchObject({
      enabled: false,
      error: "通知設定を保存できませんでした",
    })
  )
})
it("ignores subscription rejection from a previous account", async () => {
  let reject: (error: Error) => void = () => {}
  vi.mocked(subscribePush).mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail
    })
  )
  await preparePushControl("first")
  await setPushEnabled(true)
  await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledOnce())
  await preparePushControl("second")
  reject(new DOMException("blocked", "NotAllowedError"))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(saveNotificationPreference).toHaveBeenCalledTimes(1)
  expect(getPushControlState()).toMatchObject({ enabled: false, error: null })
})
