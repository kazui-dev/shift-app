import {
  disablePushSubscription,
  getPushSubscriptions,
  savePushSubscription,
} from "@/api/push"
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
  pending: boolean
  error: string | null
}
const empty: State = {
  enabled: null,
  permission: null,
  pending: false,
  error: null,
}
const listeners = new Set<() => void>()
let state = empty
let owner: string | null = null
let generation = 0
let reading = 0
let preparation: Promise<void> | null = null
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
  reading++
  stopWatching?.()
  stopWatching = undefined
  owner = null
  preparation = null
  state = empty
  publish({})
}
export function preparePushControl(memberId: string): Promise<void> {
  if (!pushSupported()) return Promise.resolve()
  if (owner === memberId) {
    if (state.error && state.enabled === null) return refreshPushControl()
    return preparation ?? Promise.resolve()
  }
  resetPushControl()
  owner = memberId
  const account = generation
  preparation = refreshPushControl().then(() => {
    if (account === generation)
      stopWatching = watchNotificationPermission(() => {
        void refreshPushControl()
      })
  })
  return preparation
}
export async function refreshPushControl(): Promise<void> {
  if (!owner) return
  const account = generation,
    revision = ++reading
  try {
    publish({ permission: readNotificationPermission() })
    if (state.pending) return
    const subscription = await readPushSubscription()
    const registrations = subscription ? await getPushSubscriptions() : []
    if (account !== generation || revision !== reading || state.pending) return
    publish({
      enabled:
        subscription !== null &&
        registrations.some(
          (value) => value.endpoint === subscription.endpoint && value.enabled
        ),
      error: null,
    })
  } catch {
    if (
      account === generation &&
      revision === reading &&
      state.enabled === null
    )
      publish({ error: "通知設定を確認できませんでした" })
  }
}
export async function setPushEnabled(enabled: boolean): Promise<void> {
  if (!owner || state.pending) return
  const account = generation
  reading++
  publish({ pending: true, error: null })
  try {
    if (enabled) {
      // Only an explicit ON action may request permission; use the current browser value.
      const permission =
        readNotificationPermission() === "granted"
          ? "granted"
          : await Notification.requestPermission()
      if (account !== generation) return
      publish({ permission })
      if (permission !== "granted") {
        if (permission === "denied")
          publish({ error: "通知を許可してください" })
        return
      }
      const existing = await readPushSubscription()
      if (account !== generation) return
      if (existing) {
        const registrations = await getPushSubscriptions()
        if (account !== generation) return
        if (
          !registrations.some((value) => value.endpoint === existing.endpoint)
        )
          await existing.unsubscribe()
      }
      if (account !== generation) return
      const subscription = await subscribePush()
      if (account !== generation) return
      await savePushSubscription(subscription)
    } else {
      const subscription = await readPushSubscription()
      if (account !== generation) return
      if (subscription) {
        await disablePushSubscription(subscription.endpoint)
        // Server delivery is already disabled even if browser cleanup fails.
        if (account === generation)
          await subscription.unsubscribe().catch(() => false)
      }
    }
    if (account === generation) publish({ enabled })
  } catch {
    if (account === generation)
      publish({ error: "通知設定を変更できませんでした" })
  } finally {
    if (account === generation) publish({ pending: false })
  }
}
