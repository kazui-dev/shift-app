import { expect, it, vi } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import { planOf } from "./use-shift-plan"
import {
  transferAssignment,
  assignmentEditWarning,
} from "./transfer-assignment"

it("moves only the selected member, keeps the time, and preserves existing drafts", () => {
  vi.spyOn(Date, "now").mockReturnValue(0)
  try {
    const [source, target] = makeEditors()
    const slot = source?.slots[0],
      memberId = slot?.memberIds[0]
    if (!source || !target || !slot || !memberId) throw new Error("fixture")
    const draft = { ...planOf(target), name: "編集中" }
    const result = transferAssignment(
      source,
      target,
      { [target.activity.id]: { base: planOf(target), plan: draft } },
      { ...slot, slotId: slot.id, memberId }
    )
    if ("error" in result) throw new Error(result.error)
    const from = result.updates[source.activity.id],
      to = result.updates[target.activity.id]
    expect(from?.plan.slots.find((s) => s.id === slot.id)?.memberIds).toEqual(
      slot.memberIds.filter((id) => id !== memberId)
    )
    expect(to?.plan.name).toBe("編集中")
    const moved = to?.plan.slots.find((s) => s.memberIds.includes(memberId))
    expect(moved).toMatchObject({
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    })
    expect(moved?.id).not.toBe(slot.id)
    expect(from?.atomic && to?.atomic).toBe(true)
    expect(source.slots[0]?.memberIds).toContain(memberId)
  } finally {
    vi.restoreAllMocks()
  }
})

it("warns using saved end time and recorded attendance without blocking changes", () => {
  const source = makeEditors()[0],
    slot = source?.slots[0],
    memberId = slot?.memberIds[0]
  if (!source || !slot || !memberId) throw new Error("fixture")
  const value = {
    ...slot,
    slotId: slot.id,
    memberId,
    endsAt: "2099-01-01T00:00:00.000Z",
  }
  expect(assignmentEditWarning(source, value, 0)).toBeNull()
  expect(
    assignmentEditWarning(source, value, Date.parse(slot.endsAt))
  ).toContain("終了済み")
  expect(
    assignmentEditWarning({ ...source, assignmentStates: [] }, value, 0)
  ).toBeNull()
  expect(
    assignmentEditWarning(
      {
        ...source,
        assignmentStates: [{ slotId: slot.id, memberId, recorded: true }],
      },
      value,
      0
    )
  ).toContain("勤怠記録")
})

it.each([false, true])(
  "allows moving recorded work even when ended=%s",
  (ended) => {
    vi.spyOn(Date, "now").mockReturnValue(
      ended ? Date.parse("2099-01-01T00:00:00Z") : 0
    )
    try {
      const [source, target] = makeEditors()
      const slot = source?.slots[0],
        memberId = slot?.memberIds[0]
      if (!source || !target || !slot || !memberId) throw new Error("fixture")
      const recorded = {
        ...source,
        assignmentStates: [{ slotId: slot.id, memberId, recorded: true }],
      }
      const value = { ...slot, slotId: slot.id, memberId }
      expect(assignmentEditWarning(recorded, value)).toContain(
        ended ? "終了済みで、勤怠記録" : "勤怠記録"
      )
      expect(transferAssignment(recorded, target, {}, value)).toHaveProperty(
        "updates"
      )
    } finally {
      vi.restoreAllMocks()
    }
  }
)
