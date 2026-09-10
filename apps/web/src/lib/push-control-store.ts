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
let initialization: Promise<void> | null = null
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

export function initializePushControl(): Promise<void> {
  if (!pushNotificationsSupported() || state.enabled !== null) {
    return Promise.resolve()
  }
  if (initialization) return initialization

  initialization = navigator.serviceWorker
    .getRegistration()
    .then((registration) =>
      registration ? registration.pushManager.getSubscription() : null
    )
    .then((subscription) => {
      dispatch({ type: "loaded", enabled: subscription !== null })
    })
    .catch(() => {
      dispatch({ type: "loaded", enabled: false })
    })
  return initialization
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
  await initializePushControl()
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
