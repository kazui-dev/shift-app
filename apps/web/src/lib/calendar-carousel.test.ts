import { describe, expect, it } from "vite-plus/test"

import {
  calendarMonthSlideValues,
  calendarSlideDates,
  calendarWeekSlideDates,
} from "./calendar-carousel"
import {
  createLoopCarouselState,
  loopCarouselInitialSlide as calendarInitialSlide,
  loopCarouselProgress as calendarSwipeOffset,
  reduceLoopCarousel,
  type LoopCarouselEvent,
  type LoopCarouselState,
} from "./loop-carousel"

function createCalendarCarouselState(date: string) {
  return createLoopCarouselState(date, calendarSlideDates)
}

function reduceCalendarCarousel(
  state: LoopCarouselState<string>,
  event: LoopCarouselEvent<string>
) {
  return reduceLoopCarousel(state, event, calendarSlideDates)
}

describe("calendar carousel slots", () => {
  it("centers consecutive dates in stable circular slots", () => {
    expect(calendarSlideDates("2026-08-27", calendarInitialSlide)).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ])
  })

  it("rebases dates around a selected slot without moving the slot", () => {
    expect(calendarSlideDates("2026-09-01", 6)).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ])
    expect(calendarSlideDates("2026-09-01", 0)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
    ])
  })

  it("maps loop progress to adjacent slide progress", () => {
    const snaps = [0, 1 / 7, 2 / 7, 3 / 7, 4 / 7, 5 / 7, 6 / 7]

    expect(calendarSwipeOffset(3.5 / 7, 3, snaps)).toBeCloseTo(0.5)
    expect(calendarSwipeOffset(3.5 / 7, 4, snaps)).toBeCloseTo(-0.5)
    expect(calendarSwipeOffset(2.25 / 7, 3, snaps)).toBeCloseTo(-0.75)
    expect(calendarSwipeOffset(0.5 / 7, 0, snaps)).toBeCloseTo(0.5)
    expect(calendarSwipeOffset(6.5 / 7, 0, snaps)).toBeCloseTo(-0.5)
    expect(calendarSwipeOffset(0.5 / 7, 6, snaps)).toBe(1)
    expect(calendarSwipeOffset(3 / 7, 3, snaps)).toBe(0)
    expect(calendarSwipeOffset(5 / 7, 3, snaps)).toBe(1)
    expect(calendarSwipeOffset(1 / 7, 3, snaps)).toBe(-1)
  })

  it("rejects missing and duplicate snap geometry", () => {
    expect(calendarSwipeOffset(0.5, 0, [])).toBe(0)
    expect(calendarSwipeOffset(0.5, 4, [0, 0.5])).toBe(0)
    expect(calendarSwipeOffset(0.5, 0, [0, 0])).toBe(0)
    const sparseSnaps = [0]
    sparseSnaps.length = 2
    expect(calendarSwipeOffset(0.25, 0, sparseSnaps)).toBe(0)
  })
})

describe("calendar carousel transitions", () => {
  it("commits the selected date before animation settles", () => {
    const initial = createCalendarCarouselState("2026-08-27")
    const dragging = reduceCalendarCarousel(initial, { type: "pointerDown" })
    const selected = reduceCalendarCarousel(dragging, {
      type: "select",
      index: 4,
    })

    expect(dragging).toMatchObject({
      index: 3,
      phase: "dragging",
      value: "2026-08-27",
    })
    expect(selected).toMatchObject({
      index: 4,
      phase: "animating",
      value: "2026-08-28",
    })
    expect(reduceCalendarCarousel(selected, { type: "settle" })).toMatchObject({
      index: 4,
      phase: "idle",
      value: "2026-08-28",
    })
  })

  it("settles a cancelled drag without changing the date", () => {
    const initial = createCalendarCarouselState("2026-08-27")
    const dragging = reduceCalendarCarousel(initial, { type: "pointerDown" })
    const released = reduceCalendarCarousel(dragging, { type: "pointerUp" })
    const settled = reduceCalendarCarousel(released, { type: "settle" })

    expect(settled).toMatchObject({
      index: 3,
      phase: "idle",
      value: "2026-08-27",
    })
  })

  it("rebases every interrupted selection across the loop boundary", () => {
    let state = createCalendarCarouselState("2026-08-27")

    for (const index of [4, 5, 6, 0]) {
      state = reduceCalendarCarousel(state, { type: "pointerDown" })
      state = reduceCalendarCarousel(state, { type: "select", index })
      state = reduceCalendarCarousel(state, { type: "pointerUp" })
    }

    expect(state).toMatchObject({
      index: 0,
      phase: "animating",
      value: "2026-08-31",
    })
    expect(state.values[0]).toBe("2026-08-31")
  })

  it("rebases interrupted reverse selections across the loop boundary", () => {
    let state = createCalendarCarouselState("2026-08-27")

    for (const index of [2, 1, 0, 6]) {
      state = reduceCalendarCarousel(state, { type: "select", index })
    }

    expect(state).toMatchObject({ index: 6, value: "2026-08-23" })
    expect(state.values[6]).toBe("2026-08-23")
  })

  it("makes an external replacement authoritative during animation", () => {
    const selected = reduceCalendarCarousel(
      createCalendarCarouselState("2026-08-27"),
      { type: "select", index: 4 }
    )
    const replaced = reduceCalendarCarousel(selected, {
      type: "replace",
      index: 4,
      value: "2027-01-15",
    })

    expect(replaced).toMatchObject({
      index: 4,
      phase: "idle",
      value: "2027-01-15",
    })
    expect(reduceCalendarCarousel(replaced, { type: "settle" })).toEqual(
      replaced
    )
  })

  it("preserves the logical date when Embla reinitializes", () => {
    const state = reduceCalendarCarousel(
      createCalendarCarouselState("2026-08-27"),
      { type: "reInit", index: 5 }
    )

    expect(state).toMatchObject({
      index: 5,
      phase: "idle",
      value: "2026-08-27",
    })
    expect(state.values[5]).toBe("2026-08-27")
  })

  it("ignores a selected index outside the physical slots", () => {
    const state = createCalendarCarouselState("2026-08-27")

    expect(reduceCalendarCarousel(state, { type: "select", index: 7 })).toBe(
      state
    )
  })
})

describe("calendar period carousel slots", () => {
  it("moves week slides by seven days while preserving the weekday", () => {
    expect(calendarWeekSlideDates("2026-08-27", 3)).toEqual([
      "2026-08-06",
      "2026-08-13",
      "2026-08-20",
      "2026-08-27",
      "2026-09-03",
      "2026-09-10",
      "2026-09-17",
    ])
  })

  it("moves month slides across year boundaries", () => {
    expect(calendarMonthSlideValues("2026-12", 3)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
    ])
  })
})
