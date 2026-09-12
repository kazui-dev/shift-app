import { readNotificationPermission } from "./notification-permission"
import {
  pushControlInitialState,
  reducePushControl,
  type PushControlEvent,
  type PushControlState,
} from "./push-control-state"
import {
  clearPushControlIntent,
  loadPushControlIntent,
  savePushControlIntent,
} from "./push-control-intent"

type Listener = () => void

const listeners = new Set<Listener>()
let state = pushControlInitialState
let refreshing: Promise<void> | null = null
let refreshRequested = false
let synchronization: Promise<void> | null = null
let activeOwner: string | null = null

export function pushNotificationsSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

function dispatch(event: PushControlEvent): void {
  const nextState = reducePushControl(state, event)
  if (nextState === state) return
  state = nextState
  for (const listener of listeners) listener()
}

async function readPushControl(): Promise<void> {
  if (!refreshRequested || state.syncing) return
  refreshRequested = false
  const snapshot = state
  try {
    const [permission, subscription] = await Promise.all([
      readNotificationPermission(),
      navigator.serviceWorker
        .getRegistration()
        .then((registration) =>
          registration ? registration.pushManager.getSubscription() : null
        ),
    ])
    if (!refreshRequested && state === snapshot)
      dispatch({
        type: "loaded",
        enabled: permission === "granted" && subscription !== null,
      })
  } catch {
    if (!refreshRequested && state === snapshot && state.enabled === null)
      dispatch({ type: "loaded", enabled: false })
  }
  if (refreshRequested) await readPushControl()
}

export function refreshPushControl(): Promise<void> {
  if (!pushNotificationsSupported() || state.syncing) return Promise.resolve()
  refreshRequested = true
  if (refreshing) return refreshing
  refreshing = readPushControl().finally(() => {
    refreshing = null
  })
  return refreshing
}

export function initializePushControl(): Promise<void> {
  return (
    refreshing ??
    (state.enabled === null ? refreshPushControl() : Promise.resolve())
  )
}

function intentStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function clearIntent(owner: string | null): void {
  const storage = intentStorage()
  if (storage && owner) clearPushControlIntent(storage, owner)
}

export async function preparePushControl(owner: string): Promise<void> {
  await refreshPushControl()
  activeOwner = owner
  const storage = intentStorage()
  if (!storage) return
  const enabled = loadPushControlIntent(storage, owner)
  if (enabled === null) return
  if (state.confirmedEnabled === enabled) {
    clearPushControlIntent(storage, owner)
    return
  }
  dispatch({ type: "requested", enabled })
}

export function getPushControlState(): PushControlState {
  return state
}

export function subscribePushControl(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function requestPushControlState(enabled: boolean): boolean {
  const previous = state
  dispatch({ type: "requested", enabled })
  const storage = intentStorage()
  if (state !== previous && storage && activeOwner) {
    savePushControlIntent(storage, activeOwner, enabled)
  }
  return state !== previous
}

async function syncLatestPushControl(
  sync: (enabled: boolean) => Promise<void>
): Promise<void> {
  const target = state.enabled
  if (target === null || target === state.confirmedEnabled) return
  try {
    await sync(target)
    dispatch({ type: "synced", enabled: target })
    if (state.enabled === state.confirmedEnabled) clearIntent(activeOwner)
  } catch (error) {
    const latestRequestFailed = state.enabled === target
    dispatch({ type: "failed", enabled: target })
    if (latestRequestFailed) {
      clearIntent(activeOwner)
      throw error
    }
  }
  return syncLatestPushControl(sync)
}

export function synchronizePushControl(
  sync: (enabled: boolean) => Promise<void>
): Promise<void> | null {
  if (synchronization) return null
  if (state.enabled === state.confirmedEnabled) {
    if (state.syncing && state.enabled !== null) {
      dispatch({ type: "synced", enabled: state.enabled })
      clearIntent(activeOwner)
    }
    return null
  }

  synchronization = syncLatestPushControl(sync).finally(() => {
    synchronization = null
  })
  return synchronization
}
