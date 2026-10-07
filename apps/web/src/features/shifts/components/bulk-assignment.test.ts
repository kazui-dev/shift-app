import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { expect, it } from "vite-plus/test"
import { makeEditors, uuid } from "../../../../dev/fixtures"
import { planOf } from "./use-shift-plan"
import { assignMembers, reviewAssignments } from "./bulk-assignment"
function fixture() {
  const data = makeEditors()[0]
  if (!data) throw new Error("Missing fixture")
  const plan: ActivityEditorInput = { ...planOf(data), slots: [] }
  const window = {
    startsAt: "2026-11-01T01:00:00.000Z",
    endsAt: "2026-11-01T02:00:00.000Z",
  }
  return { data, plan, window }
}
it("deduplicates members into one shared slot without changing the original plan", () => {
  const { data, plan, window } = fixture()
  const result = assignMembers(data, plan, [uuid(1), uuid(2), uuid(1)], window)
  if ("error" in result) throw new Error(result.error)
  expect(plan.slots).toEqual([])
  expect(result.plan.slots).toHaveLength(1)
  expect(result.plan.slots[0]?.memberIds).toEqual([uuid(1), uuid(2)])
  const extended = assignMembers(data, result.plan, [uuid(4)], window)
  if ("error" in extended) throw new Error(extended.error)
  expect(extended.plan.slots[0]?.id).toBe(result.plan.slots[0]?.id)
  expect(extended.plan.slots[0]?.memberIds).toEqual([uuid(1), uuid(2), uuid(4)])
  expect(result.plan.slots[0]?.memberIds).toEqual([uuid(1), uuid(2)])
})
it("reviews all warning categories and blocks collisions and duplicates", () => {
  const { data, plan, window } = fixture()
  data.availabilityAnswers = [1, 2, 3, 4, 5].map((n) => ({
    memberId: uuid(n),
    date: "2026-11-01",
    choice: n === 2 ? "no" : "times",
  }))
  data.availability = [1, 3, 4, 5].map((n) => ({
    memberId: uuid(n),
    startsAt: window.startsAt,
    endsAt: n === 3 ? "2026-11-01T01:30:00.000Z" : window.endsAt,
  }))
  data.otherAssignments = [{ memberId: uuid(4), ...window, name: "他の勤務" }]
  plan.slots = [
    { id: uuid(999), ...window, capacity: null, memberIds: [uuid(5)] },
  ]
  expect(
    reviewAssignments(
      data,
      plan,
      [
        uuid(1),
        uuid(2),
        uuid(3),
        uuid(4),
        uuid(5),
        uuid(6),
        "unknown",
        uuid(1),
      ],
      window
    ).map((row) => [row.blocked, row.reason])
  ).toEqual([
    [false, null],
    [false, "参加不可"],
    [false, "希望時間外"],
    [true, "この時間には別のシフトがあります。"],
    [true, "割当済み"],
    [false, "未回答"],
    [true, "対象年度のメンバーではありません。"],
  ])
})
it("fails atomically for collisions, invalid members, time bounds and API limits", () => {
  const { data, plan, window } = fixture()
  data.otherAssignments = [{ memberId: uuid(2), ...window, name: "他" }]
  expect(assignMembers(data, plan, [uuid(1), uuid(2)], window)).toHaveProperty(
    "error"
  )
  expect(plan.slots).toEqual([])
  expect(assignMembers(data, plan, [], window)).toHaveProperty("error")
  expect(assignMembers(data, plan, ["unknown"], window)).toHaveProperty("error")
  expect(
    assignMembers(data, plan, [uuid(1)], { ...window, startsAt: "bad" })
  ).toHaveProperty("error")
  expect(
    assignMembers(data, plan, [uuid(1)], { ...window, endsAt: window.startsAt })
  ).toHaveProperty("error")
  expect(
    assignMembers(data, plan, [uuid(1)], {
      ...window,
      startsAt: "2026-10-31T23:00:00Z",
    })
  ).toHaveProperty("error")
  expect(
    assignMembers(data, { ...plan, version: 0 }, [uuid(1)], window)
  ).toHaveProperty("error")
})

it("enforces the shared-slot member limit before changing the editor", () => {
  const { data, plan, window } = fixture()
  const member = data.members[0]
  if (!member) throw new Error("Missing member")
  data.members = Array.from({ length: 501 }, (_, index) => ({
    ...member,
    id: uuid(500000 + index),
  }))
  const ids = data.members.map((item) => item.id)
  expect(assignMembers(data, plan, ids.slice(0, 500), window)).toHaveProperty(
    "plan"
  )
  expect(assignMembers(data, plan, ids, window)).toHaveProperty("error")
  expect(plan.slots).toEqual([])
})
