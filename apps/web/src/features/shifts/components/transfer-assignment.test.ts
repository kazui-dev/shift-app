import { expect, it, vi } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import { planOf } from "./use-shift-plan"
import { transferAssignment, transferBlocked } from "./transfer-assignment"

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

it("uses the saved end time and refuses missing or recorded attendance state", () => {
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
  expect(transferBlocked(source, value, 0)).toBe(false)
  expect(transferBlocked(source, value, Date.parse(slot.endsAt))).toBe(true)
  expect(transferBlocked({ ...source, assignmentStates: [] }, value, 0)).toBe(
    true
  )
  expect(
    transferBlocked(
      {
        ...source,
        assignmentStates: [{ slotId: slot.id, memberId, recorded: true }],
      },
      value,
      0
    )
  ).toBe(true)
})
