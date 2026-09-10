import {
  pushControlInitialState,
  reducePushControl,
  type PushControlEvent,
  type PushControlState,
} from "./push-control-state"

type Listener = () => void

const listeners = new Set<Listener>()
let state = pushControlInitialState
let initialization: Promise<void> | null = null
let synchronization: Promise<void> | null = null

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
  } catch (error) {
    const latestRequestFailed = state.enabled === target
    dispatch({ type: "failed", enabled: target })
    if (latestRequestFailed) throw error
  }
  return syncLatestPushControl(sync)
}

export function synchronizePushControl(
  sync: (enabled: boolean) => Promise<void>
): Promise<void> | null {
  if (synchronization || state.enabled === state.confirmedEnabled) return null

  synchronization = syncLatestPushControl(sync).finally(() => {
    synchronization = null
  })
  return synchronization
}
