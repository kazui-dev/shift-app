import { expect, it } from "vite-plus/test"
import { timeScale } from "./time-scale"

const scale = timeScale(
  "2026-09-13T09:30:00+09:00",
  "2026-09-13T12:00:00+09:00"
)

it("marks every hour plus both ends, hiding marks that crowd an end", () => {
  expect(scale.hours.map((hour) => new Date(hour).toISOString())).toEqual([
    "2026-09-13T00:30:00.000Z",
    "2026-09-13T01:00:00.000Z",
    "2026-09-13T02:00:00.000Z",
    "2026-09-13T03:00:00.000Z",
  ])
  expect(scale.labels).toEqual([
    scale.start,
    Date.parse("2026-09-13T10:00:00+09:00"),
    Date.parse("2026-09-13T11:00:00+09:00"),
    scale.end,
  ])
  expect(
    timeScale("2026-09-13T09:50:00+09:00", "2026-09-13T10:40:00+09:00").labels
  ).toEqual([
    Date.parse("2026-09-13T09:50:00+09:00"),
    Date.parse("2026-09-13T10:40:00+09:00"),
  ])
})

it("snaps a pointer to five minutes and never leaves the shift", () => {
  expect(scale.minuteAt(0, 0, 150)).toBe(0)
  expect(scale.minuteAt(-40, 0, 150)).toBe(0)
  expect(scale.minuteAt(1000, 0, 150)).toBe(150)
  expect(scale.minuteAt(7, 0, 150)).toBe(5)
})

it("keeps a dragged range at least a minute long and inside the shift", () => {
  expect(scale.range("m", 60, 30)).toEqual({
    memberId: "m",
    slotId: null,
    startsAt: "2026-09-13T01:00:00.000Z",
    endsAt: "2026-09-13T01:30:00.000Z",
  })
  expect(scale.range("m", 150, 150)).toEqual({
    memberId: "m",
    slotId: null,
    startsAt: "2026-09-13T02:59:00.000Z",
    endsAt: "2026-09-13T03:00:00.000Z",
  })
})

it("places an interval as a share of the shift, clipped to its window", () => {
  expect(
    scale.position("2026-09-13T09:00:00+09:00", "2026-09-13T10:30:00+09:00")
  ).toEqual({ left: "0%", width: "40%" })
  expect(
    scale.position("2026-09-13T13:00:00+09:00", "2026-09-13T14:00:00+09:00")
  ).toEqual({ left: "140%", width: "0%" })
})

it("moves one slot edge without collapsing the slot", () => {
  const slot = {
    id: "slot",
    startsAt: "2026-09-13T10:00:00+09:00",
    endsAt: "2026-09-13T11:00:00+09:00",
    capacity: null,
    memberIds: [],
  }
  expect(scale.resize(slot, "start", 150).startsAt).toBe(
    "2026-09-13T01:55:00.000Z"
  )
  expect(scale.resize(slot, "end", 0).endsAt).toBe("2026-09-13T01:05:00.000Z")
  expect(scale.resize(slot, "end", 120).startsAt).toBe(slot.startsAt)
})
