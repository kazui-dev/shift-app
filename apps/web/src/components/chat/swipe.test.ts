import { expect, it } from "vite-plus/test"
import { swipeDestination, swipeIntent } from "./swipe"

it("commits a deliberate drag or a short flick in either direction", () => {
  expect(swipeDestination(1, 140, 390, 0)).toBe(0)
  expect(swipeDestination(0, -140, 390, 0)).toBe(1)
  expect(swipeDestination(1, 45, 390, 0.7)).toBe(0)
  expect(swipeDestination(0, -45, 390, -0.7)).toBe(1)
})
it("keeps the current panel for a short drag or a reversal", () => {
  expect(swipeDestination(1, 60, 390, 0.1)).toBe(1)
  expect(swipeDestination(1, 160, 390, -0.5)).toBe(1)
  expect(swipeDestination(0, -160, 390, 0.5)).toBe(0)
  expect(swipeDestination(1, 8, 390, 2)).toBe(1)
  expect(swipeDestination(0, -8, 390, -2)).toBe(0)
  expect(swipeDestination(1, 100, 0, 1)).toBe(1)
})
it("does not navigate beyond the list or the conversation", () => {
  expect(swipeDestination(0, 180, 390, 1)).toBe(0)
  expect(swipeDestination(1, -180, 390, -1)).toBe(1)
})

it("leaves taps, vertical scrolling, and outward gestures to the browser", () => {
  expect(swipeIntent(1, 3, 4)).toBe("pending")
  expect(swipeIntent(1, 10, 40)).toBe("native")
  expect(swipeIntent(1, 30, 20)).toBe("native")
  expect(swipeIntent(0, 50, 0)).toBe("native")
  expect(swipeIntent(1, -50, 0)).toBe("native")
})
it("claims only inward horizontal movement beyond the tap threshold", () => {
  expect(swipeIntent(1, 40, 10)).toBe("horizontal")
  expect(swipeIntent(0, -40, 10)).toBe("horizontal")
})
