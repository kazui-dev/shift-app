import { expect, it } from "vite-plus/test"
import { staffing } from "./staffing"
const at = (time: string) => `2026-10-29T${time}:00.000Z`
it("counts actual members at minute boundaries, including adjacent and overlapping slots", () => {
  const periods = staffing({
    startsAt: at("08:00"),
    endsAt: at("09:00"),
    requirements: [
      { id: "r", startsAt: at("08:00"), endsAt: at("08:41"), requiredCount: 2 },
    ],
    slots: [
      {
        id: "a",
        startsAt: at("07:00"),
        endsAt: at("08:17"),
        memberIds: ["a", "b"],
        capacity: null,
      },
      {
        id: "b",
        startsAt: at("08:17"),
        endsAt: at("09:30"),
        memberIds: ["b"],
        capacity: null,
      },
      {
        id: "c",
        startsAt: at("08:16"),
        endsAt: at("08:18"),
        memberIds: ["b"],
        capacity: null,
      },
    ],
  })
  expect(
    periods.map((p) => [
      p.startsAt.slice(11, 16),
      p.endsAt.slice(11, 16),
      p.assigned,
      p.required,
      p.shortage,
    ])
  ).toEqual([
    ["08:00", "08:16", 2, 2, false],
    ["08:16", "08:17", 2, 2, false],
    ["08:17", "08:18", 1, 2, true],
    ["08:18", "08:41", 1, 2, true],
    ["08:41", "09:00", 1, null, false],
  ])
})
it("distinguishes an unset requirement from an explicit zero", () => {
  expect(
    staffing({
      startsAt: at("08:00"),
      endsAt: at("09:00"),
      slots: [],
      requirements: [],
    })[0]
  ).toMatchObject({ assigned: 0, required: null, shortage: false })
  expect(
    staffing({
      startsAt: at("08:00"),
      endsAt: at("09:00"),
      slots: [],
      requirements: [
        {
          id: "r",
          startsAt: at("08:00"),
          endsAt: at("09:00"),
          requiredCount: 0,
        },
      ],
    })[0]
  ).toMatchObject({ assigned: 0, required: 0, shortage: false })
})
