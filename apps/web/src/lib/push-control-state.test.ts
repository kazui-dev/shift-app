import { describe, expect, it } from "vite-plus/test"

import {
  pushControlInitialState,
  reducePushControl,
} from "./push-control-state"

describe("push control state", () => {
  it("shows the requested state immediately and confirms it on success", () => {
    const loaded = reducePushControl(pushControlInitialState, {
      type: "loaded",
      enabled: false,
    })
    const toggled = reducePushControl(loaded, {
      type: "toggle",
      enabled: true,
    })

    expect(toggled).toEqual({
      confirmedEnabled: false,
      enabled: true,
      pending: true,
    })
    expect(reducePushControl(toggled, { type: "success" })).toEqual({
      confirmedEnabled: true,
      enabled: true,
      pending: false,
    })
  })

  it("returns to the confirmed state when the request fails", () => {
    const loaded = reducePushControl(pushControlInitialState, {
      type: "loaded",
      enabled: true,
    })
    const toggled = reducePushControl(loaded, {
      type: "toggle",
      enabled: false,
    })

    expect(reducePushControl(toggled, { type: "failure" })).toEqual({
      confirmedEnabled: true,
      enabled: true,
      pending: false,
    })
  })

  it("ignores duplicate and concurrent toggle requests", () => {
    const loaded = reducePushControl(pushControlInitialState, {
      type: "loaded",
      enabled: false,
    })
    const toggled = reducePushControl(loaded, {
      type: "toggle",
      enabled: true,
    })

    expect(reducePushControl(loaded, { type: "toggle", enabled: false })).toBe(
      loaded
    )
    expect(reducePushControl(toggled, { type: "toggle", enabled: false })).toBe(
      toggled
    )
    expect(
      reducePushControl(pushControlInitialState, {
        type: "toggle",
        enabled: true,
      })
    ).toBe(pushControlInitialState)
  })
})
