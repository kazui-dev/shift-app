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
      type: "requested",
      enabled: true,
    })

    expect(toggled).toEqual({
      confirmedEnabled: false,
      enabled: true,
      syncing: true,
    })
    expect(
      reducePushControl(toggled, { type: "synced", enabled: true })
    ).toEqual({
      confirmedEnabled: true,
      enabled: true,
      syncing: false,
    })
  })

  it("returns to the confirmed state when the request fails", () => {
    const loaded = reducePushControl(pushControlInitialState, {
      type: "loaded",
      enabled: true,
    })
    const toggled = reducePushControl(loaded, {
      type: "requested",
      enabled: false,
    })

    expect(
      reducePushControl(toggled, { type: "failed", enabled: false })
    ).toEqual({
      confirmedEnabled: true,
      enabled: true,
      syncing: false,
    })
  })

  it("keeps the latest request while an earlier request is syncing", () => {
    const loaded = reducePushControl(pushControlInitialState, {
      type: "loaded",
      enabled: false,
    })
    const enabling = reducePushControl(loaded, {
      type: "requested",
      enabled: true,
    })
    const disabling = reducePushControl(enabling, {
      type: "requested",
      enabled: false,
    })

    expect(disabling).toEqual({
      confirmedEnabled: false,
      enabled: false,
      syncing: true,
    })
    expect(
      reducePushControl(disabling, { type: "synced", enabled: true })
    ).toEqual({
      confirmedEnabled: true,
      enabled: false,
      syncing: true,
    })
    expect(
      reducePushControl(disabling, { type: "failed", enabled: true })
    ).toBe(disabling)
  })

  it("ignores requests before loading and duplicate requests", () => {
    const loaded = reducePushControl(pushControlInitialState, {
      type: "loaded",
      enabled: false,
    })

    expect(
      reducePushControl(loaded, { type: "requested", enabled: false })
    ).toBe(loaded)
    expect(
      reducePushControl(pushControlInitialState, {
        type: "requested",
        enabled: true,
      })
    ).toBe(pushControlInitialState)
  })
})
