const fallbackSettleDelay = 240
const nativeScrollEndWatchdogDelay = 600
const stablePositionTolerance = 0.5

export function pagerSettleDelay(hasNativeScrollEnd: boolean) {
  return hasNativeScrollEnd ? nativeScrollEndWatchdogDelay : fallbackSettleDelay
}

export function pagerPositionIsStable(previous: number, current: number) {
  return Math.abs(current - previous) <= stablePositionTolerance
}
