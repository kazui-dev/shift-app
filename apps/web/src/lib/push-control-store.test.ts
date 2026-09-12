import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import {
  disablePushSubscription,
  getPushSubscriptions,
  savePushSubscription,
} from "@/api/push"
import { readPushSubscription, subscribePush } from "./push-browser"
import {
  readNotificationPermission,
  watchNotificationPermission,
} from "./notification-permission"
import {
  getPushControlState,
  preparePushControl,
  refreshPushControl,
  resetPushControl,
  setPushEnabled,
} from "./push-control-store"

vi.mock("@/api/push", () => ({
  getPushSubscriptions: vi.fn<typeof getPushSubscriptions>(),
  savePushSubscription: vi.fn<typeof savePushSubscription>(),
  disablePushSubscription: vi.fn<typeof disablePushSubscription>(),
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
  endpoint: "https://push.example/one",
  expirationTime: null,
  keys: { p256dh: "key", auth: "auth" },
}
const request = vi.fn<typeof Notification.requestPermission>()
beforeEach(() => {
  resetPushControl()
  vi.resetAllMocks()
  vi.stubGlobal("Notification", { requestPermission: request })
  request.mockResolvedValue("granted")
  vi.mocked(readNotificationPermission).mockReturnValue("granted")
  vi.mocked(readPushSubscription).mockResolvedValue(null)
  vi.mocked(getPushSubscriptions).mockResolvedValue([])
  vi.mocked(subscribePush).mockResolvedValue(sub)
})
afterEach(() => {
  resetPushControl()
  vi.unstubAllGlobals()
})
it("does not invent an initial OFF state or create records and prompts during startup", async () => {
  expect(getPushControlState().enabled).toBeNull()
  await preparePushControl("member")
  expect(getPushControlState().enabled).toBe(false)
  expect(request).not.toHaveBeenCalled()
  expect(getPushSubscriptions).not.toHaveBeenCalled()
  expect(savePushSubscription).not.toHaveBeenCalled()
})
it("requests permission synchronously from ON even after a denied observation", async () => {
  vi.mocked(readNotificationPermission).mockReturnValue("denied")
  await preparePushControl("member")
  const enabling = setPushEnabled(true)
  expect(request).toHaveBeenCalledOnce()
  await enabling
  expect(savePushSubscription).toHaveBeenCalledWith(sub)
  expect(getPushControlState()).toMatchObject({
    enabled: true,
    permission: "granted",
    pending: false,
  })
})
it("does not subscribe after denial or dismissal and keeps the action available", async () => {
  vi.mocked(readNotificationPermission).mockReturnValue("denied")
  await preparePushControl("member")
  request.mockResolvedValueOnce("denied")
  await setPushEnabled(true)
  expect(getPushControlState()).toMatchObject({
    enabled: false,
    pending: false,
    error: "通知を許可してください",
  })
  request.mockResolvedValueOnce("default")
  await setPushEnabled(true)
  expect(getPushControlState().error).toBeNull()
  expect(subscribePush).not.toHaveBeenCalled()
})
it("does not call a subscription failure a user denial or turn ON before server confirmation", async () => {
  await preparePushControl("member")
  vi.mocked(subscribePush).mockRejectedValueOnce(
    new DOMException("Failed", "NotAllowedError")
  )
  await setPushEnabled(true)
  expect(getPushControlState()).toMatchObject({
    enabled: false,
    error: "通知設定を変更できませんでした",
  })
  vi.mocked(savePushSubscription).mockRejectedValueOnce(new Error("network"))
  await setPushEnabled(true)
  expect(getPushControlState().enabled).toBe(false)
})
it("reads permission changes in both directions without prompting or changing delivery preferences", async () => {
  await preparePushControl("member")
  vi.mocked(readNotificationPermission).mockReturnValue("denied")
  await refreshPushControl()
  expect(getPushControlState().permission).toBe("denied")
  vi.mocked(readNotificationPermission).mockReturnValue("granted")
  await refreshPushControl()
  expect(getPushControlState()).toMatchObject({
    permission: "granted",
    enabled: false,
  })
  expect(request).not.toHaveBeenCalled()
  expect(savePushSubscription).not.toHaveBeenCalled()
})
it("ignores late enable results after account disposal", async () => {
  let resolve: (value: NotificationPermission) => void = () => undefined
  vi.mocked(readNotificationPermission).mockReturnValue("denied")
  request.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  await preparePushControl("member")
  const enabling = setPushEnabled(true)
  resetPushControl()
  resolve("granted")
  await enabling
  expect(savePushSubscription).not.toHaveBeenCalled()
  expect(getPushControlState().enabled).toBeNull()
})

it("initializes an enabled subscription as ON and stops server delivery before unsubscribing", async () => {
  const unsubscribe = vi.fn<() => Promise<boolean>>(async () => true)
  const native: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    options: { applicationServerKey: null, userVisibleOnly: true },
    getKey: () => null,
    toJSON: () => sub,
    unsubscribe,
  }
  vi.mocked(readPushSubscription).mockResolvedValue(native)
  vi.mocked(getPushSubscriptions).mockResolvedValue([
    { endpoint: sub.endpoint, enabled: true },
  ])
  await preparePushControl("member")
  expect(getPushControlState().enabled).toBe(true)
  vi.mocked(disablePushSubscription).mockImplementationOnce(async () => {
    expect(unsubscribe).not.toHaveBeenCalled()
  })
  await setPushEnabled(false)
  expect(disablePushSubscription).toHaveBeenCalledWith(sub.endpoint)
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(getPushControlState()).toMatchObject({
    enabled: false,
    pending: false,
  })
  expect(request).not.toHaveBeenCalled()
})

it("retries a failed initial read when settings are opened again", async () => {
  vi.mocked(readPushSubscription).mockRejectedValueOnce(
    new Error("unavailable")
  )
  await preparePushControl("member")
  expect(getPushControlState().enabled).toBeNull()
  await preparePushControl("member")
  expect(getPushControlState()).toMatchObject({ enabled: false, error: null })
})

it("does not request permission again when the browser already grants notifications", async () => {
  await preparePushControl("member")
  await setPushEnabled(true)
  expect(request).not.toHaveBeenCalled()
  expect(savePushSubscription).toHaveBeenCalledWith(sub)
})
