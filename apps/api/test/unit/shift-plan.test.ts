import { describe, it, expect } from "vite-plus/test"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { validateShiftPlan } from "../../src/domain/shift-plan"
const at = (hour: number) =>
  `2026-11-01T${String(hour).padStart(2, "0")}:00:00+09:00`
const slot = {
  id: "slot",
  startsAt: at(10),
  endsAt: at(12),
  capacity: null,
  memberIds: ["m"],
}
const plan: ActivityEditorInput = {
  candidateRoleIds: [],
  name: "Shift",
  place: "Campus",
  activityType: "Shift",
  startsAt: at(9),
  endsAt: at(18),
  color: "#000000",
  notes: null,
  active: false,
  version: 1,
  responsibles: [],
  slots: [slot],
}
describe("shift plan validation", () => {
  it("keeps empty slots and treats capacity as guidance", () => {
    expect(
      validateShiftPlan(
        { ...plan, slots: [{ ...slot, memberIds: [], capacity: 1 }] },
        [],
        [],
        []
      )
    ).toEqual({ error: null, outside: [] })
  })
  it("warns about unavailable and unsubmitted members", () => {
    expect(validateShiftPlan(plan, ["m"], [], [])).toEqual({
      error: null,
      outside: ["m"],
    })
  })
  it("accepts a matching availability and adjacent work", () => {
    expect(
      validateShiftPlan(
        plan,
        ["m"],
        [
          { memberId: "m", startsAt: at(12), endsAt: at(13) },
          { memberId: "other", startsAt: at(10), endsAt: at(12) },
        ],
        [{ memberId: "m", startsAt: at(9), endsAt: at(18) }]
      ).error
    ).toBeNull()
  })
  it.each([
    { input: { ...plan, endsAt: at(8) }, error: "INVALID_TIME_RANGE" },
    { input: { ...plan, slots: [slot, slot] }, error: "DUPLICATE_SLOT" },
    {
      input: { ...plan, slots: [{ ...slot, endsAt: at(9) }] },
      error: "SLOT_OUTSIDE_SHIFT",
    },
    {
      input: { ...plan, slots: [{ ...slot, startsAt: at(8) }] },
      error: "SLOT_OUTSIDE_SHIFT",
    },
    {
      input: { ...plan, slots: [{ ...slot, endsAt: at(19) }] },
      error: "SLOT_OUTSIDE_SHIFT",
    },
    {
      input: { ...plan, slots: [{ ...slot, memberIds: ["m", "m"] }] },
      error: "DUPLICATE_MEMBER",
    },
    {
      input: { ...plan, slots: [{ ...slot, memberIds: ["missing"] }] },
      error: "YEAR_MEMBERSHIP_REQUIRED",
    },
    {
      input: { ...plan, slots: [slot, { ...slot, id: "second" }] },
      error: "SHIFT_OVERLAP",
    },
  ])("rejects $error", ({ input, error }) => {
    expect(validateShiftPlan(input, ["m"], [], []).error).toBe(error)
  })
  it("rejects conflicts with other shifts regardless of visibility", () => {
    expect(
      validateShiftPlan(
        plan,
        ["m"],
        [{ memberId: "m", startsAt: at(11), endsAt: at(14) }],
        []
      ).error
    ).toBe("SHIFT_OVERLAP")
  })
  it("does not count another person's or partial availability", () => {
    expect(
      validateShiftPlan(
        plan,
        ["m"],
        [],
        [
          { memberId: "other", startsAt: at(9), endsAt: at(18) },
          { memberId: "m", startsAt: at(11), endsAt: at(18) },
          { memberId: "m", startsAt: at(9), endsAt: at(11) },
        ]
      ).outside
    ).toEqual(["m"])
  })
})
