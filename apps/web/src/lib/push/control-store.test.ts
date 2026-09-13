import { beforeEach, afterEach, expect, it, vi } from "vite-plus/test"
import {
  getNotificationDevices,
  saveNotificationPreference,
  saveDeviceSubscription,
} from "@/api/push"
import { ApiError } from "@/api/client"
import { readPushSubscription, subscribePush } from "@/lib/push/browser"
import { watchNotificationPermission } from "@/lib/push/permission"
import {
  getPushControlState,
  preparePushControl,
  resetPushControl,
  setPushEnabled,
} from "@/lib/push/control-store"
vi.mock("@/api/push", () => ({
  getNotificationDevices: vi.fn<typeof getNotificationDevices>(),
  saveNotificationPreference: vi.fn<typeof saveNotificationPreference>(),
  saveDeviceSubscription: vi.fn<typeof saveDeviceSubscription>(),
}))
vi.mock("./browser", () => ({
  pushSupported: () => true,
  readPushSubscription: vi.fn<typeof readPushSubscription>(),
  subscribePush: vi.fn<typeof subscribePush>(),
  withPushLock: (action: () => Promise<void>) => action(),
}))
vi.mock("./permission", () => ({
  watchNotificationPermission: vi.fn<typeof watchNotificationPermission>(),
}))
const id = "00000000-0000-4000-8000-000000000000"
const sub = {
  endpoint: "https://push.example/1",
  expirationTime: null,
  keys: { p256dh: "key", auth: "auth" },
}
const unsubscribe = vi.fn<() => Promise<boolean>>()
const browserSubscription: PushSubscription = {
  ...sub,
  options: { userVisibleOnly: true, applicationServerKey: null },
  getKey: () => null,
  toJSON: () => sub,
  unsubscribe,
}
const request = vi.fn<typeof Notification.requestPermission>()
const storage = new Map<string, string>()
beforeEach(() => {
  resetPushControl()
  vi.resetAllMocks()
  storage.clear()
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: request,
  })
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  vi.mocked(watchNotificationPermission).mockReturnValue(() => {})
  vi.mocked(getNotificationDevices).mockResolvedValue([])
  vi.mocked(readPushSubscription).mockResolvedValue(null)
  vi.mocked(subscribePush).mockResolvedValue(sub)
  request.mockResolvedValue("granted")
  unsubscribe.mockResolvedValue(true)
})
afterEach(() => {
  resetPushControl()
  vi.unstubAllGlobals()
})
function observe(permission: NotificationPermission) {
  vi.mocked(watchNotificationPermission).mock.calls.at(-1)?.[0](permission)
}
it("keeps startup unknown and observes permission before I/O without prompting", async () => {
  let finish: (value: []) => void = () => {}
  vi.mocked(getNotificationDevices).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const work = preparePushControl("member")
  expect(watchNotificationPermission).toHaveBeenCalledOnce()
  expect(getPushControlState().enabled).toBeNull()
  finish([])
  await work
  expect(getPushControlState().enabled).toBe(false)
  expect(request).not.toHaveBeenCalled()
})
it.each(["denied", "default", "granted"] as const)(
  "restores saved ON independently of %s permission and missing subscription",
  async (permission) => {
    vi.stubGlobal("Notification", { permission, requestPermission: request })
    storage.set("notification-device:member", id)
    vi.mocked(getNotificationDevices).mockResolvedValue([
      { id, enabled: true, endpoint: null },
    ])
    await preparePushControl("member")
    expect(getPushControlState().enabled).toBe(true)
    expect(saveNotificationPreference).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  }
)
it.each(["denied", "default"] as const)(
  "saves ON even when the prompt returns %s",
  async (permission) => {
    request.mockResolvedValue(permission)
    await preparePushControl("member")
    const saving = setPushEnabled(true)
    expect(getPushControlState().enabled).toBe(true)
    expect(request).toHaveBeenCalledOnce()
    await saving
    expect(saveNotificationPreference).toHaveBeenCalledWith(
      expect.any(String),
      true
    )
    expect(getPushControlState()).toEqual({ enabled: true, error: null })
    expect(subscribePush).not.toHaveBeenCalled()
  }
)
it.each(["throw", "reject"])(
  "preserves ON when the permission request fails: %s",
  async (mode) => {
    if (mode === "throw")
      request.mockImplementationOnce(() => {
        throw new Error("prompt")
      })
    else request.mockRejectedValueOnce(new Error("prompt"))
    await preparePushControl("member")
    await setPushEnabled(true)
    await Promise.resolve()
    expect(getPushControlState()).toEqual({ enabled: true, error: null })
    expect(saveNotificationPreference).toHaveBeenCalledWith(
      expect.any(String),
      true
    )
  }
)
it("saves ON and OFF while the native dialog is still open and shares repeated ON requests", async () => {
  let finish: (value: NotificationPermission) => void = () => {}
  request.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await preparePushControl("member")
  await setPushEnabled(true)
  await setPushEnabled(false)
  await setPushEnabled(true)
  await setPushEnabled(false)
  expect(request).toHaveBeenCalledOnce()
  expect(
    vi.mocked(saveNotificationPreference).mock.calls.map((call) => call[1])
  ).toEqual([true, false, true, false])
  finish("granted")
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(getPushControlState().enabled).toBe(false)
  expect(saveDeviceSubscription).not.toHaveBeenCalled()
})
it("allows permission, ON, block, OFF, reallow, ON even when both read APIs stay denied", async () => {
  vi.stubGlobal("Notification", {
    permission: "denied",
    requestPermission: request,
  })
  await preparePushControl("member")
  observe("denied")
  await setPushEnabled(true)
  await vi.waitFor(() => expect(saveDeviceSubscription).toHaveBeenCalledOnce())
  observe("denied")
  expect(getPushControlState().enabled).toBe(true)
  await setPushEnabled(false)
  observe("denied")
  await setPushEnabled(true)
  await vi.waitFor(() =>
    expect(saveDeviceSubscription).toHaveBeenCalledTimes(2)
  )
  expect(request).toHaveBeenCalledTimes(2)
  expect(getPushControlState().enabled).toBe(true)
})
it("OFF neither prompts nor unsubscribes, even while registration is pending", async () => {
  let finish: (value: typeof sub) => void = () => {}
  vi.mocked(subscribePush).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await preparePushControl("member")
  await setPushEnabled(true)
  await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledOnce())
  await setPushEnabled(false)
  expect(saveNotificationPreference).toHaveBeenLastCalledWith(
    expect.any(String),
    false
  )
  finish(sub)
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(saveDeviceSubscription).not.toHaveBeenCalled()
  expect(unsubscribe).not.toHaveBeenCalled()
  expect(request).toHaveBeenCalledOnce()
})
it("serializes writes and preserves the newest choice while an older write fails", async () => {
  let fail: (error: Error) => void = () => {}
  vi.mocked(saveNotificationPreference).mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject
    })
  )
  await preparePushControl("member")
  const on = setPushEnabled(true)
  const off = setPushEnabled(false)
  expect(getPushControlState().enabled).toBe(false)
  await vi.waitFor(() =>
    expect(saveNotificationPreference).toHaveBeenCalledOnce()
  )
  fail(new Error("network"))
  await Promise.all([on, off])
  expect(getPushControlState()).toEqual({ enabled: false, error: null })
  expect(saveNotificationPreference).toHaveBeenLastCalledWith(
    expect.any(String),
    false
  )
})
it("rolls back only failed preference persistence and permits the next operation", async () => {
  await preparePushControl("member")
  vi.mocked(saveNotificationPreference).mockRejectedValueOnce(
    new Error("network")
  )
  await setPushEnabled(true)
  expect(getPushControlState()).toEqual({
    enabled: false,
    error: "通知設定を保存できませんでした",
  })
  expect(subscribePush).not.toHaveBeenCalled()
  await setPushEnabled(true)
  expect(getPushControlState()).toEqual({ enabled: true, error: null })
})
it.each(["NotAllowedError", "SecurityError"])(
  "keeps ON without a toast for subscription permission failure %s",
  async (name) => {
    vi.mocked(subscribePush).mockRejectedValueOnce(
      new DOMException("blocked", name)
    )
    await preparePushControl("member")
    await setPushEnabled(true)
    await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getPushControlState()).toEqual({ enabled: true, error: null })
    expect(saveNotificationPreference).toHaveBeenCalledTimes(1)
  }
)
it.each(["browser", "server"])(
  "keeps ON and reports %s transport failures",
  async (source) => {
    if (source === "browser")
      vi.mocked(subscribePush).mockRejectedValueOnce(new Error("network"))
    else
      vi.mocked(saveDeviceSubscription).mockRejectedValueOnce(
        new Error("network")
      )
    await preparePushControl("member")
    await setPushEnabled(true)
    await vi.waitFor(() =>
      expect(getPushControlState()).toEqual({
        enabled: true,
        error: "通知の登録に失敗しました",
      })
    )
  }
)
it("permission changes can retry transport but never write or replace the preference", async () => {
  await preparePushControl("member")
  request.mockResolvedValueOnce("denied")
  await setPushEnabled(true)
  observe("granted")
  await vi.waitFor(() => expect(saveDeviceSubscription).toHaveBeenCalledOnce())
  observe("denied")
  expect(getPushControlState().enabled).toBe(true)
  expect(saveNotificationPreference).toHaveBeenCalledOnce()
})
it("recovers existing identity by endpoint even with a stale saved id", async () => {
  storage.set(
    "notification-device:member",
    "00000000-0000-4000-8000-000000000001"
  )
  vi.mocked(readPushSubscription).mockResolvedValue(browserSubscription)
  vi.mocked(getNotificationDevices).mockResolvedValue([
    { id, enabled: false, endpoint: sub.endpoint },
  ])
  await preparePushControl("member")
  await setPushEnabled(true)
  expect(saveNotificationPreference).toHaveBeenCalledWith(id, true)
  expect(storage.get("notification-device:member")).toBe(id)
})
it("retains unknown after startup failure and retries on the next visit", async () => {
  vi.mocked(getNotificationDevices).mockRejectedValueOnce(new Error("network"))
  await preparePushControl("member")
  expect(getPushControlState()).toEqual({
    enabled: null,
    error: "通知設定を確認できませんでした",
  })
  await preparePushControl("member")
  expect(getPushControlState()).toEqual({ enabled: false, error: null })
})
it("ignores the previous account's delayed permission and subscription results", async () => {
  let finish: (value: typeof sub) => void = () => {}
  vi.mocked(subscribePush).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await preparePushControl("first")
  await setPushEnabled(true)
  await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledOnce())
  await preparePushControl("second")
  finish(sub)
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(saveDeviceSubscription).not.toHaveBeenCalled()
  expect(getPushControlState()).toEqual({ enabled: false, error: null })
})
it("replaces a conflicting endpoint only following an explicit ON, without taking ownership", async () => {
  vi.mocked(readPushSubscription).mockResolvedValue(browserSubscription)
  vi.mocked(saveDeviceSubscription).mockRejectedValueOnce(
    new ApiError("conflict", 409, "SUBSCRIPTION_CONFLICT")
  )
  await preparePushControl("member")
  await setPushEnabled(true)
  await vi.waitFor(() =>
    expect(saveDeviceSubscription).toHaveBeenCalledTimes(2)
  )
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(getPushControlState().enabled).toBe(true)
})

it("does not report an old registration error after a newer ON and retries that latest request", async () => {
  let fail: (error: Error) => void = () => {}
  vi.mocked(subscribePush).mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject
    })
  )
  await preparePushControl("member")
  await setPushEnabled(true)
  await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledOnce())
  await setPushEnabled(false)
  await setPushEnabled(true)
  await new Promise((resolve) => setTimeout(resolve, 0))
  fail(new Error("old network error"))
  await vi.waitFor(() => expect(subscribePush).toHaveBeenCalledTimes(2))
  expect(getPushControlState()).toEqual({ enabled: true, error: null })
})
it("does not register for a different account when the previous account's prompt resolves", async () => {
  let finish: (permission: NotificationPermission) => void = () => {}
  request.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  await preparePushControl("first")
  await setPushEnabled(true)
  await preparePushControl("second")
  finish("granted")
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(subscribePush).not.toHaveBeenCalled()
  expect(getPushControlState()).toEqual({ enabled: false, error: null })
})
