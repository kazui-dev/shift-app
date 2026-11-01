import { expect, it } from "vite-plus/test"
import {
  anchoredScroll,
  resizedHourWidth,
  timelineMarks,
  timelineStep,
} from "./timeline-width"
const start = Date.parse("2026-11-01T09:00:00+09:00")
const end = Date.parse("2026-11-01T12:00:00+09:00")

it("adds clock-aligned half-hour and quarter-hour labels only when they fit", () => {
  expect([96, 120, 240].map(timelineStep)).toEqual([60, 30, 15])
  expect(timelineMarks(start, end, 96)).toHaveLength(4)
  expect(timelineMarks(start, end, 120)).toHaveLength(7)
  expect(timelineMarks(start, end, 240)).toHaveLength(13)
  const unevenStart = start + 50 * 60_000
  const marks = timelineMarks(unevenStart, end - 20 * 60_000, 96)
  expect(marks).toEqual([unevenStart, start + 2 * 3_600_000, end - 20 * 60_000])
  expect(timelineMarks(start, start + 10 * 60_000, 48)).toEqual([start])
})

it("resizes every hour equally from the dragged interval and clamps the range", () => {
  expect(resizedHourWidth(96, 24, 1)).toBe(120)
  expect(resizedHourWidth(120, 30, 0.5)).toBe(180)
  expect(resizedHourWidth(240, 12, 0.25)).toBe(288)
  expect(resizedHourWidth(96, -500, 1)).toBe(48)
  expect(resizedHourWidth(96, 500, 1)).toBe(384)
})

it("keeps a chosen time at the same viewport position while zooming", () => {
  const oldScroll = 300
  const screenX = 600
  const nameWidth = 192
  const time = (oldScroll + screenX - nameWidth - 24) / 96
  const scroll = anchoredScroll(240, time, screenX, nameWidth)
  expect(nameWidth + 24 + time * 240 - scroll).toBe(screenX)
  expect(anchoredScroll(48, 0, screenX, nameWidth)).toBe(0)
})
