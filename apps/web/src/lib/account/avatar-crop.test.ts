import { describe, expect, it } from "vite-plus/test"

import {
  circleSide,
  clampFrame,
  coveringScale,
  cropRect,
  initialFrame,
  midpoint,
  spread,
  zoomFrame,
} from "./avatar-crop"

const wide = { width: 400, height: 200 }
const viewport = 200

describe("avatar framing", () => {
  it("starts with the whole of the shorter side, centred", () => {
    const frame = initialFrame(wide, viewport)
    expect(frame).toEqual({ scale: 1, x: -100, y: 0 })
    expect(cropRect(frame, viewport)).toEqual({ x: 100, y: 0, size: 200 })
  })

  it("covers the viewport whichever side is shorter", () => {
    expect(coveringScale(wide, viewport)).toBe(1)
    expect(coveringScale({ width: 100, height: 400 }, viewport)).toBe(2)
  })

  it("never lets an edge move inside the viewport", () => {
    expect(clampFrame({ scale: 1, x: 50, y: 20 }, wide, viewport)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    })
    expect(clampFrame({ scale: 1, x: -900, y: -900 }, wide, viewport)).toEqual({
      scale: 1,
      x: -200,
      y: 0,
    })
  })

  it("refuses a scale that would uncover the viewport, and bounds zooming in", () => {
    expect(clampFrame({ scale: 0.1, x: 0, y: 0 }, wide, viewport).scale).toBe(1)
    expect(clampFrame({ scale: 50, x: 0, y: 0 }, wide, viewport).scale).toBe(8)
  })

  it("keeps the point under the fingers while zooming", () => {
    const frame = { scale: 1, x: -100, y: 0 }
    const zoomed = zoomFrame(frame, wide, viewport, 2, { x: 100, y: 100 })
    expect(zoomed.scale).toBe(2)
    // The source pixel at the centre stays at the centre.
    const before = cropRect(frame, viewport)
    const after = cropRect(zoomed, viewport)
    expect(after.x + after.size / 2).toBeCloseTo(before.x + before.size / 2)
    expect(after.y + after.size / 2).toBeCloseTo(before.y + before.size / 2)
  })

  it("sizes the circle to the screen, leaving room for the controls", () => {
    expect(circleSide(390, 844)).toBe(342)
    expect(circleSide(1440, 900)).toBe(420)
    expect(circleSide(320, 480)).toBe(272)
    // A window too small for any circle asks for none rather than a negative.
    expect(circleSide(320, 100)).toBe(0)
  })

  it("measures the gesture between two pointers", () => {
    expect(spread({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 8 })).toEqual({ x: 2, y: 4 })
  })
})
