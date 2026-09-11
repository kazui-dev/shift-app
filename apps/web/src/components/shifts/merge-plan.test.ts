import { describe, expect, it } from "vite-plus/test"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { mergePlan } from "./merge-plan"
const base: ActivityEditorInput = {
  version: 1,
  name: "受付",
  place: "入口",
  activityType: "shift",
  startsAt: "2026-09-11T00:00:00Z",
  endsAt: "2026-09-11T09:00:00Z",
  color: "#888888",
  notes: null,
  active: false,
  responsibles: [],
  candidateRoleIds: [],
  slots: [
    {
      id: "one",
      startsAt: "2026-09-11T01:00:00Z",
      endsAt: "2026-09-11T03:00:00Z",
      capacity: null,
      memberIds: ["a"],
    },
  ],
}
describe("mergePlan", () => {
  it("preserves independent changes and adopts the latest version", () => {
    const result = mergePlan(
      base,
      { ...base, name: "案内" },
      { ...base, version: 2, place: "正門" }
    )
    expect(result.conflicts).toEqual([])
    expect(result.plan).toMatchObject({
      name: "案内",
      place: "正門",
      version: 2,
    })
  })
  it("requires an explicit choice when both change the same field", () => {
    const local = { ...base, name: "案内" },
      latest = { ...base, name: "本部" }
    expect(
      mergePlan(base, local, latest).conflicts.map((item) => item.key)
    ).toEqual(["name"])
    expect(mergePlan(base, local, latest, { name: "latest" }).plan.name).toBe(
      "本部"
    )
    expect(mergePlan(base, local, latest, { name: "local" }).conflicts).toEqual(
      []
    )
    expect(mergePlan(base, local, local).conflicts).toEqual([])
  })
  it("combines independent people added to an existing shift", () => {
    const local = {
      ...base,
      slots: base.slots.map((slot) => ({ ...slot, memberIds: ["a", "b"] })),
    }
    const latest = {
      ...base,
      slots: base.slots.map((slot) => ({ ...slot, memberIds: ["c"] })),
    }
    expect(mergePlan(base, local, latest).plan.slots[0]?.memberIds).toEqual([
      "b",
      "c",
    ])
  })
  it("retains a new shift from either editor", () => {
    const local = {
      ...base,
      slots: base.slots.map((slot) => ({ ...slot, id: "new" })),
    }
    const result = mergePlan(base, local, base)
    expect(result.conflicts).toEqual([])
    expect(result.plan.slots.map((slot) => slot.id)).toEqual(["new"])
  })
  it("does not silently discard a change when the other editor deletes the shift", () => {
    const latest = {
      ...base,
      slots: base.slots.map((slot) => ({ ...slot, capacity: 3 })),
    }
    expect(
      mergePlan(base, { ...base, slots: [] }, latest).conflicts[0]?.key
    ).toBe("slot:one")
    expect(
      mergePlan(base, { ...base, slots: [] }, latest, { "slot:one": "local" })
        .plan.slots
    ).toEqual([])
    expect(
      mergePlan(base, { ...base, slots: [] }, latest, { "slot:one": "latest" })
        .plan.slots[0]?.capacity
    ).toBe(3)
  })
})
