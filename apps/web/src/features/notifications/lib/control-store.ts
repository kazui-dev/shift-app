import * as v from "valibot"
import {
  getNotificationDevices,
  saveNotificationPreference,
  saveDeviceSubscription,
} from "@/features/notifications/api/push"
import { ApiError } from "@/lib/http/client"
import {
  pushSupported,
  readPushSubscription,
  subscribePush,
  withPushLock,
} from "@/features/notifications/lib/browser"
import { watchNotificationPermission } from "@/features/notifications/lib/permission"

type State = { enabled: boolean | null; error: string | null }
type Session = {
  memberId: string
  deviceId: string
  confirmed: boolean
  revision: number
  loaded: boolean
  permission: NotificationPermission
  preparation: Promise<void> | null
  writes: Promise<void>
  prompt: Promise<NotificationPermission | null> | null
  transport: Promise<void> | null
  retryTransport: boolean
  reportTransport: boolean
  stop: () => void
}
const initial: State = { enabled: null, error: null }
let state = initial
let session: Session | null = null
const listeners = new Set<() => void>()
function publish(patch: Partial<State>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}
export const getPushControlState = () => state
export function subscribePushControl(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function resetPushControl() {
  session?.stop()
  session = null
  publish(initial)
}
function wanted(current: Session) {
  return session === current && current.loaded && state.enabled === true
}
function denied(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  )
}
function syncTransport(current: Session, report = false): Promise<void> {
  if (!wanted(current)) return Promise.resolve()
  current.reportTransport ||= report
  if (current.transport) {
    current.retryTransport = true
    return current.transport
  }
  const revision = current.revision
  current.transport = withPushLock(async () => {
    await current.writes
    if (!wanted(current) || !current.confirmed) return
    let subscription = await subscribePush()
    if (!wanted(current)) return
    try {
      await saveDeviceSubscription(current.deviceId, subscription)
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.code !== "SUBSCRIPTION_CONFLICT" ||
        !current.reportTransport
      )
        throw error
      const previous = await readPushSubscription()
      if (!wanted(current)) return
      if (previous && !(await previous.unsubscribe()))
        throw new Error("Unsubscribe failed", { cause: error })
      if (!wanted(current)) return
      subscription = await subscribePush()
      if (!wanted(current)) return
      await saveDeviceSubscription(current.deviceId, subscription)
    }
  })
    .catch((error: unknown) => {
      if (
        wanted(current) &&
        revision === current.revision &&
        current.reportTransport &&
        !denied(error)
      )
        publish({ error: "通知の登録に失敗しました" })
    })
    .finally(() => {
      current.transport = null
      const retry = current.retryTransport
      const notify = current.reportTransport
      current.retryTransport = false
      current.reportTransport = false
      if (retry && wanted(current)) void syncTransport(current, notify)
    })
  return current.transport
}
function initialize(current: Session): Promise<void> {
  if (current.preparation) return current.preparation
  current.preparation = (async () => {
    const key = `notification-device:${current.memberId}`
    let saved: string | null = null
    try {
      saved = localStorage.getItem(key)
    } catch {
      /* Session-only storage remains usable. */
    }
    const [devices, subscription] = await Promise.all([
      getNotificationDevices(),
      readPushSubscription(),
    ])
    if (session !== current) return
    const device =
      devices.find((value) => value.endpoint === subscription?.endpoint) ??
      devices.find((value) => value.id === saved)
    current.deviceId =
      device?.id ??
      (v.is(v.pipe(v.string(), v.uuid()), saved) ? saved : current.deviceId)
    current.confirmed = device?.enabled ?? false
    try {
      localStorage.setItem(key, current.deviceId)
    } catch {
      /* Keep this session's device identity. */
    }
    current.loaded = true
    publish({ enabled: current.confirmed, error: null })
    if (current.permission === "granted") void syncTransport(current)
  })()
    .catch(() => {
      if (session === current)
        publish({ error: "通知設定を確認できませんでした" })
    })
    .finally(() => {
      current.preparation = null
    })
  return current.preparation
}
export function preparePushControl(memberId: string): Promise<void> {
  if (!pushSupported()) return Promise.resolve()
  if (session?.memberId === memberId)
    return session.loaded ? Promise.resolve() : initialize(session)
  resetPushControl()
  const current: Session = {
    memberId,
    deviceId: crypto.randomUUID(),
    confirmed: false,
    revision: 0,
    loaded: false,
    permission: Notification.permission,
    preparation: null,
    writes: Promise.resolve(),
    prompt: null,
    transport: null,
    retryTransport: false,
    reportTransport: false,
    stop: () => {},
  }
  session = current
  current.stop = watchNotificationPermission((permission) => {
    if (session !== current) return
    current.permission = permission
    if (!current.loaded) {
      void initialize(current)
      return
    }
    if (permission === "granted" && !current.prompt) void syncTransport(current)
  })
  return initialize(current)
}
function requestPermission(
  current: Session
): Promise<NotificationPermission | null> {
  if (current.prompt) return current.prompt
  // Read APIs can retain stale WebAPK permission. Only the user gesture requests permission.
  let result: Promise<NotificationPermission>
  try {
    result = Notification.requestPermission()
  } catch {
    return Promise.resolve(null)
  }
  current.prompt = result
    .then(
      (permission) => {
        if (session === current) current.permission = permission
        return permission
      },
      () => null
    )
    .finally(() => {
      current.prompt = null
    })
  return current.prompt
}
export function setPushEnabled(enabled: boolean): Promise<void> {
  const current = session
  if (!current?.loaded) return Promise.resolve()
  const revision = ++current.revision
  publish({ enabled, error: null })
  // Preference persistence never waits for the permission dialog or Push service.
  const decision = enabled ? requestPermission(current) : null
  const saved = current.writes.then(async () => {
    if (session !== current) return
    try {
      await saveNotificationPreference(current.deviceId, enabled)
      if (session === current) current.confirmed = enabled
    } catch {
      if (session === current && revision === current.revision)
        publish({
          enabled: current.confirmed,
          error: "通知設定を保存できませんでした",
        })
    }
  })
  current.writes = saved
  if (decision)
    void Promise.all([saved, decision]).then(([, permission]) => {
      if (
        wanted(current) &&
        revision === current.revision &&
        permission === "granted"
      )
        void syncTransport(current, true)
    })
  return saved
}
