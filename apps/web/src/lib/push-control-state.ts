export type PushControlState = {
  confirmedEnabled: boolean | null
  enabled: boolean | null
  syncing: boolean
}

export type PushControlEvent =
  | { type: "loaded"; enabled: boolean }
  | { type: "requested"; enabled: boolean }
  | { type: "synced"; enabled: boolean }
  | { type: "failed"; enabled: boolean }

export const pushControlInitialState: PushControlState = {
  confirmedEnabled: null,
  enabled: null,
  syncing: false,
}

export function reducePushControl(
  state: PushControlState,
  event: PushControlEvent
): PushControlState {
  if (event.type === "loaded") {
    return {
      confirmedEnabled: event.enabled,
      enabled: event.enabled,
      syncing: false,
    }
  }
  if (event.type === "requested") {
    if (state.enabled === null || state.enabled === event.enabled) {
      return state
    }
    return { ...state, enabled: event.enabled, syncing: true }
  }
  if (event.type === "synced") {
    return {
      confirmedEnabled: event.enabled,
      enabled: state.enabled,
      syncing: state.enabled !== event.enabled,
    }
  }
  if (state.enabled !== event.enabled) return state
  return {
    ...state,
    enabled: state.confirmedEnabled,
    syncing: false,
  }
}
