import * as v from "valibot"
import {
  getNotificationDevices,
  saveNotificationPreference,
  saveDeviceSubscription,
} from "@/api/push"
import { ApiError } from "@/api/client"
import {
  pushSupported,
  readPushSubscription,
  subscribePush,
} from "./push-browser"
import {
  readNotificationPermission,
  watchNotificationPermission,
} from "./notification-permission"

type State = {
  enabled: boolean | null
  permission: NotificationPermission | null
  requesting: boolean
  error: string | null
}
const empty: State = {
  enabled: null,
  permission: null,
  requesting: false,
  error: null,
}
const listeners = new Set<() => void>()
let state = empty
let owner: string | null = null
let deviceId = ""
let generation = 0
let edit = 0
let confirmed = false
let registered = false
let writes: Promise<void> = Promise.resolve()
let preparation: Promise<void> | null = null
let syncing: Promise<void> | null = null
let stopWatching: (() => void) | undefined
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
  generation++
  stopWatching?.()
  stopWatching = undefined
  owner = null
  deviceId = ""
  edit = 0
  confirmed = false
  registered = false
  writes = Promise.resolve()
  preparation = null
  syncing = null
  state = empty
  publish({})
}
function permissionChanged(permission: NotificationPermission) {
  publish({ permission })
  if (permission !== "granted") registered = false
  else if (state.enabled && !state.requesting) void syncSubscription()
}
export function preparePushControl(memberId: string): Promise<void> {
  if (!pushSupported()) return Promise.resolve()
  if (owner === memberId) return preparation ?? Promise.resolve()
  resetPushControl()
  owner = memberId
  const account = generation
  publish({ permission: readNotificationPermission() })
  stopWatching = watchNotificationPermission(permissionChanged)
  preparation = (async () => {
    const key = `notification-device:${memberId}`
    let saved: string | null = null
    try {
      saved = localStorage.getItem(key)
    } catch {
      /* Storage may be unavailable. */
    }
    deviceId = v.is(v.pipe(v.string(), v.uuid()), saved)
      ? saved
      : crypto.randomUUID()
    try {
      const [devices, subscription] = await Promise.all([
        getNotificationDevices(),
        readPushSubscription().catch(() => null),
      ])
      if (account !== generation) return
      const current = devices.find((device) =>
        saved
          ? device.id === deviceId
          : subscription && device.endpoint === subscription.endpoint
      )
      if (current) deviceId = current.id
      confirmed = current?.enabled ?? false
      registered = !!subscription && current?.endpoint === subscription.endpoint
      publish({ enabled: confirmed })
    } catch {
      if (account !== generation) return
      publish({ enabled: false, error: "通知設定を確認できませんでした" })
    }
    if (account !== generation) return
    try {
      localStorage.setItem(key, deviceId)
    } catch {
      /* The current session remains usable. */
    }
    if (state.enabled && state.permission === "granted") void syncSubscription()
  })()
  return preparation
}
async function syncSubscription(report = false): Promise<void> {
  if (syncing) return syncing
  if (!owner || !state.enabled || state.permission !== "granted" || registered)
    return
  const account = generation,
    id = deviceId
  syncing = (async () => {
    try {
      await writes
      if (
        account !== generation ||
        !state.enabled ||
        state.permission !== "granted"
      )
        return
      let subscription = await subscribePush()
      if (account !== generation) return
      try {
        await saveDeviceSubscription(id, subscription)
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        const previous = await readPushSubscription()
        if (account !== generation) return
        await previous?.unsubscribe()
        subscription = await subscribePush()
        if (account !== generation) return
        await saveDeviceSubscription(id, subscription)
      }
      if (account === generation) registered = true
    } catch {
      if (account === generation && report)
        publish({ error: "通知の登録に失敗しました" })
    } finally {
      if (account === generation) syncing = null
    }
  })()
  return syncing
}
export async function enableNotifications(
  showSettingsHint = true
): Promise<void> {
  if (!owner || state.requesting) return
  const account = generation
  publish({ requesting: true, error: null })
  try {
    const permission =
      state.permission === "granted" &&
      readNotificationPermission() === "granted"
        ? "granted"
        : await Notification.requestPermission()
    if (account !== generation) return
    permissionChanged(permission)
    publish({ requesting: false })
    if (permission === "granted") void syncSubscription(true)
    else if (permission === "denied" && showSettingsHint)
      publish({ error: "端末の設定から通知を許可してください" })
  } catch {
    if (account === generation)
      publish({ error: "通知の許可を確認できませんでした" })
  } finally {
    if (account === generation) publish({ requesting: false })
  }
}
export function setPushEnabled(enabled: boolean): Promise<void> {
  if (!owner || state.enabled === null) return Promise.resolve()
  const account = generation,
    revision = ++edit,
    id = deviceId
  publish({ enabled, error: null })
  writes = writes
    .catch(() => {})
    .then(async () => {
      if (account !== generation) return
      try {
        await saveNotificationPreference(id, enabled)
        if (account === generation) confirmed = enabled
      } catch {
        if (account === generation && revision === edit)
          publish({
            enabled: confirmed,
            error: "通知設定を保存できませんでした",
          })
      }
    })
  if (enabled) void enableNotifications(false)
  return writes
}
