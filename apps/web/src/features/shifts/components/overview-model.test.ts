import type { FilterValue } from "@workspace/ui/lib/filters"
import { expect, it } from "vite-plus/test"
import type { ShiftOverview } from "@workspace/shared/shifts"
import {
  overviewInitialDate,
  overviewRows,
  overviewAttendance,
  overviewRange,
} from "./overview-model"
const data: ShiftOverview = {
  canEdit: true,
  activities: [],
  availability: [],
  availabilityAnswers: [],
  roles: [],
  members: [
    {
      id: "one",
      displayName: "One",
      studentId: "26AJ001",
      image: null,
      roles: [{ id: "r1", name: "Role", color: "#000000" }],
    },
    {
      id: "two",
      displayName: "Two",
      studentId: "26AJ002",
      image: null,
      roles: [],
    },
  ],
  assignments: [
    {
      id: "a",
      slotId: "s",
      activityId: "work",
      memberId: "one",
      startsAt: "2026-10-28T14:00:00.000Z",
      endsAt: "2026-10-28T17:00:00.000Z",
      attendance: null,
    },
  ],
}
const f = (values: string[]): FilterValue => ({ include: values, exclude: [] })
it("combines member filters with shifts without treating roles as shifts", () => {
  const filters = {
    date: "2026-10-29",
    roles: f([]),
    activities: f([]),
    search: "",
  }
  expect(overviewRows(data, filters)).toHaveLength(2)
  expect(
    overviewRows(data, { ...filters, roles: f(["r1"]), search: "26aj001" })
  ).toHaveLength(1)
  expect(
    overviewRows(data, {
      ...filters,
      activities: f(["missing"]),
    })
  ).toEqual([])
})
it("shows members assigned to any selected shift and retains all of their assignments", () => {
  const assignment = data.assignments[0]
  if (!assignment) throw new Error("Missing fixture")
  const other = { ...assignment, id: "b", activityId: "other" }
  const second = {
    ...assignment,
    id: "c",
    activityId: "second",
    memberId: "two",
  }
  const overview = {
    ...data,
    assignments: [assignment, other, second],
  }
  const filters = {
    date: "2026-10-29",
    roles: f([]),
    activities: f(["work"]),
    search: "",
  }
  expect(overviewRows(overview, filters)).toEqual([
    { member: data.members[0], assignments: [assignment, other] },
  ])
  expect(
    overviewRows(overview, {
      ...filters,
      activities: f(["work", "second"]),
    }).map((row) => row.member.id)
  ).toEqual(["one", "two"])
  expect(overviewRows(overview, { ...filters, search: "Two" })).toEqual([])
  expect(overviewRows(overview, { ...filters, roles: f(["missing"]) })).toEqual(
    []
  )
})
it("clips overnight work to the selected Japan date and never infers lateness from a missing record", () => {
  expect(overviewRange(data, "2026-10-29")).toEqual({
    start: Date.parse("2026-10-29T00:00:00+09:00"),
    end: Date.parse("2026-10-29T20:00:00+09:00"),
  })
  const assignment = data.assignments[0]
  if (!assignment) throw new Error("Missing fixture")
  expect(overviewAttendance(assignment)).toBe("出勤記録なし")
  expect(
    overviewAttendance({
      ...assignment,
      attendance: {
        state: "present",
        checkInStatus: "pending",
        checkedInAt: null,
        expectedAt: null,
        resolvedAt: null,
      },
    })
  ).toBe("出勤確認待ち")
})

it("labels recorded outcomes and retains selected work", () => {
  const assignment = data.assignments[0]
  if (!assignment) throw new Error("Missing fixture")
  const attendance = {
    state: "present",
    checkInStatus: "confirmed",
    checkedInAt: null,
    expectedAt: null,
    resolvedAt: null,
  } as const
  expect(overviewAttendance({ ...assignment, attendance })).toBe("出勤済み")
  expect(
    overviewAttendance({
      ...assignment,
      attendance: { ...attendance, state: "late" },
    })
  ).toBe("遅刻")
  expect(
    overviewAttendance({
      ...assignment,
      attendance: {
        ...attendance,
        state: "absent",
        resolvedAt: "2026-10-29T00:00:00Z",
      },
    })
  ).toBe("欠勤（対応済み）")
  expect(
    overviewRows(data, {
      date: "2026-10-29",
      roles: f(["missing"]),
      activities: f([]),
      search: "",
    })
  ).toEqual([])
  expect(
    overviewRows(data, {
      date: "2026-10-29",
      roles: f([]),
      activities: f(["work"]),
      search: "One",
    })
  ).toHaveLength(1)
  expect(overviewRange({ ...data, assignments: [] }, "2026-10-29").start).toBe(
    Date.parse("2026-10-29T08:00:00+09:00")
  )
})

it("opens today only when an active shift overlaps today, otherwise the first active shift date", () => {
  const early = {
    startsAt: "2026-10-28T23:30:00Z",
    endsAt: "2026-10-29T11:00:00Z",
    active: true,
  }
  const later = {
    startsAt: "2026-10-30T00:00:00Z",
    endsAt: "2026-10-30T11:00:00Z",
    active: true,
  }
  expect(overviewInitialDate([later, early], "2026-10-16")).toBe("2026-10-29")
  expect(overviewInitialDate([early, later], "2026-10-30")).toBe("2026-10-30")
  expect(
    overviewInitialDate([{ ...early, active: false }, later], "2026-10-29")
  ).toBe("2026-10-30")
  expect(overviewInitialDate([], "2026-10-16")).toBe("2026-10-16")
  expect(overviewInitialDate([early], "2026-11-01")).toBe("2026-10-29")
  expect(
    overviewInitialDate(
      [
        {
          ...early,
          startsAt: "2026-10-28T14:00:00Z",
          endsAt: "2026-10-28T15:00:00Z",
        },
      ],
      "2026-10-29"
    )
  ).toBe("2026-10-28")
  expect(
    overviewInitialDate(
      [
        {
          ...early,
          startsAt: "2026-10-28T14:00:00Z",
          endsAt: "2026-10-28T16:00:00Z",
        },
      ],
      "2026-10-29"
    )
  ).toBe("2026-10-29")
})
