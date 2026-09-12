import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test"
import {
  getNotificationDevices,
  saveNotificationPreference,
  saveDeviceSubscription,
} from "@/api/push"
import { readPushSubscription, subscribePush } from "./push-browser"
import {
  readNotificationPermission,
  watchNotificationPermission,
} from "./notification-permission"
import {
  getPushControlState,
  preparePushControl,
  resetPushControl,
  setPushEnabled,
  enableNotifications,
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
  readNotificationPermission: vi.fn<typeof readNotificationPermission>(),
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
  vi.stubGlobal("Notification", { requestPermission: request })
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} })
  vi.mocked(readNotificationPermission).mockReturnValue("default")
  vi.mocked(getNotificationDevices).mockResolvedValue([])
  vi.mocked(readPushSubscription).mockResolvedValue(null)
  vi.mocked(subscribePush).mockResolvedValue(sub)
  request.mockResolvedValue("denied")
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
it("turns ON immediately and saves ON even when permission is denied", async () => {
  await preparePushControl("member")
  let finish: () => void = () => {}
  vi.mocked(saveNotificationPreference).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const saving = setPushEnabled(true)
  expect(getPushControlState().enabled).toBe(true)
  expect(request).toHaveBeenCalledOnce()
  await vi.waitFor(() =>
    expect(saveNotificationPreference).toHaveBeenCalledWith(
      expect.any(String),
      true
    )
  )
  finish()
  await saving
  expect(getPushControlState().enabled).toBe(true)
  expect(subscribePush).not.toHaveBeenCalled()
})
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
})
it("explicit permission action does not turn an OFF preference ON", async () => {
  await preparePushControl("member")
  request.mockResolvedValue("granted")
  await enableNotifications()
  expect(getPushControlState()).toMatchObject({
    enabled: false,
    permission: "granted",
  })
  expect(saveNotificationPreference).not.toHaveBeenCalled()
  expect(saveDeviceSubscription).not.toHaveBeenCalled()
})
it("retains existing ON settings when the browser permission is denied", async () => {
  vi.mocked(readNotificationPermission).mockReturnValue("denied")
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
  await preparePushControl("member")
  expect(getPushControlState()).toMatchObject({
    enabled: true,
    permission: "denied",
  })
  expect(request).not.toHaveBeenCalled()
})
