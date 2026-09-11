import { expect, it } from "vite-plus/test"
import { swipeDestination } from "./swipe"

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
