export type PushControlState = {
  confirmedEnabled: boolean | null
  enabled: boolean | null
  pending: boolean
}

export type PushControlEvent =
  | { type: "loaded"; enabled: boolean }
  | { type: "toggle"; enabled: boolean }
  | { type: "success" }
  | { type: "failure" }

export const pushControlInitialState: PushControlState = {
  confirmedEnabled: null,
  enabled: null,
  pending: false,
}

export function reducePushControl(
  state: PushControlState,
  event: PushControlEvent
): PushControlState {
  if (event.type === "loaded") {
    return {
      confirmedEnabled: event.enabled,
      enabled: event.enabled,
      pending: false,
    }
  }
  if (event.type === "toggle") {
    if (
      state.pending ||
      state.enabled === null ||
      state.enabled === event.enabled
    ) {
      return state
    }
    return { ...state, enabled: event.enabled, pending: true }
  }
  if (event.type === "success") {
    return {
      confirmedEnabled: state.enabled,
      enabled: state.enabled,
      pending: false,
    }
  }
  return {
    ...state,
    enabled: state.confirmedEnabled,
    pending: false,
  }
}
