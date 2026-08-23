import { describe, expect, it } from "vite-plus/test"

import {
  pagerPositionIsStable,
  pagerSettleDelay,
} from "./calendar-pager-settle"

describe("calendar pager settling", () => {
  it("keeps the native scroll end watchdog behind the legacy fallback", () => {
    expect(pagerSettleDelay(true)).toBeGreaterThan(pagerSettleDelay(false))
  })

  it("waits again when the scroll position is still moving", () => {
    expect(pagerPositionIsStable(320, 321)).toBe(false)
    expect(pagerPositionIsStable(320, 320.25)).toBe(true)
  })
})
