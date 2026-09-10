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

export function requestPushControlState(enabled: boolean): void {
  dispatch({ type: "toggle", enabled })
}

export function confirmPushControlState(): void {
  dispatch({ type: "success" })
}

export function rollbackPushControlState(): void {
  dispatch({ type: "failure" })
}
