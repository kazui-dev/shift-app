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
import { watchNotificationPermission } from "./notification-permission"

type State = {
  enabled: boolean | null
  error: string | null
}
const empty: State = {
  enabled: null,
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
let permission: NotificationPermission | null = null
let requesting: Promise<boolean> | null = null
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
  permission = null
  requesting = null
  writes = Promise.resolve()
  preparation = null
  syncing = null
  publish(empty)
}
function permissionChanged(next: NotificationPermission) {
  permission = next
  if (permission !== "granted") registered = false
  else if (!requesting) void syncSubscription()
}
export function preparePushControl(memberId: string): Promise<void> {
  if (!pushSupported()) return Promise.resolve()
  if (owner === memberId) return preparation ?? Promise.resolve()
  resetPushControl()
  owner = memberId
  const account = generation
  permission = Notification.permission
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
      confirmed = permission !== "denied" && (current?.enabled ?? false)
      if (current?.enabled && !confirmed) {
        await saveNotificationPreference(deviceId, false)
        if (account !== generation) return
      }
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
    void syncSubscription()
  })()
  return preparation
}
async function syncSubscription(report = false): Promise<void> {
  if (syncing) return syncing
  if (!owner || !state.enabled || permission !== "granted" || registered) return
  const account = generation,
    revision = edit,
    id = deviceId
  syncing = (async () => {
    try {
      await writes
      if (account !== generation || !state.enabled || permission !== "granted")
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
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError")
      if (account !== generation || revision !== edit) return
      if (denied) {
        registered = false
        publish({ enabled: false, error: null })
        writes = writes.then(() =>
          persistPreference(false, account, revision, false)
        )
        await writes
      } else if (report) publish({ error: "通知の登録に失敗しました" })
    } finally {
      if (account === generation) {
        syncing = null
        if (revision !== edit) void syncSubscription(report)
      }
    }
  })()
  return syncing
}
function requestPermission(): Promise<boolean> {
  if (requesting) return requesting
  const account = generation
  requesting = (async () => {
    try {
      const next = await Notification.requestPermission()
      if (account !== generation) return false
      permissionChanged(next)
      return next === "granted"
    } catch {
      return false
    }
  })().finally(() => {
    if (account === generation) requesting = null
  })
  return requesting
}
async function persistPreference(
  enabled: boolean,
  account: number,
  revision: number,
  fallback: boolean
): Promise<void> {
  if (account !== generation) return
  try {
    await saveNotificationPreference(deviceId, enabled)
    if (account === generation) confirmed = enabled
  } catch {
    if (account === generation && revision === edit)
      publish({ enabled: fallback, error: "通知設定を保存できませんでした" })
  }
}
export function setPushEnabled(enabled: boolean): Promise<void> {
  if (!owner || state.enabled === null) return Promise.resolve()
  const account = generation,
    revision = ++edit
  publish({ enabled, error: null })
  // Start the native prompt within the user gesture, before queued saves.
  const decision = enabled ? requestPermission() : Promise.resolve(false)
  writes = writes.then(async () => {
    const accepted = await decision
    if (account !== generation) return
    if (revision === edit) publish({ enabled: accepted })
    await persistPreference(
      accepted,
      account,
      revision,
      enabled && !accepted ? false : confirmed
    )
  })
  return writes.then(() => {
    if (account === generation && revision === edit) void syncSubscription(true)
  })
}
