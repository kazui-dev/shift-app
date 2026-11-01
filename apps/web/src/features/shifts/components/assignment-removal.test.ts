import { expect, it, vi } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import {
  assignmentKey,
  memberSelectionKeys,
  overviewMemberKeys,
  removeAssignments,
  prepareAssignmentRemoval,
} from "./assignment-removal"
import type { EditorData } from "../editor-data"
import { planOf } from "./use-shift-plan"
import { change, undo, redo } from "./editor-history"
import { assignMember } from "./assign-member"
import { transferBlocked } from "./transfer-assignment"
import { staffing } from "./staffing"
import type { OverviewDrafts } from "./overview-draft"

const source = makeEditors()[0]
if (!source) throw new Error("Missing editor fixture")
const base = planOf(source)
const first = source.members[0],
  second = source.members[1]
if (!first || !second) throw new Error("Missing members")
const plan = {
  ...base,
  slots: [
    {
      id: "one",
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      capacity: null,
      memberIds: [first.id, second.id],
    },
    {
      id: "two",
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      capacity: null,
      memberIds: [first.id],
    },
  ],
}
const target = {
  activityId: source.activity.id,
  slotId: "one",
  memberId: first.id,
}
it("removes exactly the selected assignment and keeps work slots, other people and other slots", () => {
  const next = removeAssignments(plan, [target])
  expect(assignmentKey(target)).not.toBe(
    assignmentKey({ ...target, slotId: "two" })
  )
  expect(next.slots[0]?.memberIds).toEqual([second.id])
  expect(next.slots[1]?.memberIds).toEqual([first.id])
  expect(plan.slots[0]?.memberIds).toEqual([first.id, second.id])
  const empty = removeAssignments(plan, [
    target,
    { ...target, memberId: second.id },
    { ...target, slotId: "two" },
  ])
  expect(empty.slots).toHaveLength(2)
  expect(empty.slots.every((slot) => !slot.memberIds.length)).toBe(true)
  expect(staffing(empty).every((period) => period.assigned === 0)).toBe(true)
})
it("prepares multiple shifts without writes and keeps one undo step including existing drafts", async () => {
  const id = source.activity.id
  const existing: OverviewDrafts = {
    [id]: { base, plan: { ...plan, notes: "unsaved note" } },
  }
  const other = {
    ...source,
    activity: { ...source.activity, id: "other" },
    slots: plan.slots,
  }
  const load = vi
    .fn<(id: string) => Promise<EditorData>>()
    .mockResolvedValue(other)
  const updates = await prepareAssignmentRemoval(
    [
      target,
      { ...target, activityId: "other" },
      { ...target, activityId: "other", memberId: second.id },
    ],
    existing,
    load
  )
  expect(load).toHaveBeenCalledExactlyOnceWith("other")
  expect(updates[id]?.plan.notes).toBe("unsaved note")
  expect(updates[id]?.base).toBe(base)
  expect(updates.other?.plan.slots[0]?.memberIds).toEqual([])
  const history = change(
    { past: [], present: existing, future: [] },
    { ...existing, ...updates }
  )
  expect(undo(history).present).toEqual(existing)
  expect(redo(undo(history)).present).toEqual(history.present)
  expect(existing[id]?.plan.slots[0]?.memberIds).toEqual([first.id, second.id])
})
it("rejects changed assignments and failed loads without mutating any draft", async () => {
  const load = vi
    .fn<(id: string) => Promise<EditorData>>()
    .mockResolvedValue({ ...source, slots: plan.slots })
  await expect(
    prepareAssignmentRemoval([{ ...target, slotId: "missing" }], {}, load)
  ).rejects.toThrow("選択した勤務は変更")
  const existing: OverviewDrafts = { [source.activity.id]: { base, plan } }
  await expect(
    prepareAssignmentRemoval(
      [target, { ...target, activityId: "other" }],
      existing,
      async () => {
        throw new Error("offline")
      }
    )
  ).rejects.toThrow("offline")
  expect(existing[source.activity.id]?.plan).toBe(plan)
  expect(await prepareAssignmentRemoval([], {}, load)).toEqual({})
})

it("selects a member's existing assignments or an empty member row for assigning later", () => {
  expect(memberSelectionKeys(source.activity.id, first.id, plan.slots)).toEqual(
    [assignmentKey(target), assignmentKey({ ...target, slotId: "two" })]
  )
  expect(
    memberSelectionKeys(source.activity.id, second.id, plan.slots)
  ).toEqual([assignmentKey({ ...target, memberId: second.id })])
  expect(
    memberSelectionKeys(source.activity.id, "unassigned", plan.slots)
  ).toEqual(["member:unassigned"])
})

it("selects unassigned overview members without creating a removable assignment", () => {
  expect(overviewMemberKeys(first.id, [target])).toEqual([
    assignmentKey(target),
  ])
  const empty = overviewMemberKeys("unassigned", [])
  expect(empty).toEqual(["member:unassigned"])
  expect(
    [target].filter((item) => empty.includes(assignmentKey(item)))
  ).toEqual([])
})

it("keeps explicit removals in undo history and gives a replacement a new identity", () => {
  const removed = removeAssignments(plan, [target])
  expect(
    removeAssignments(
      { ...plan, releasedAssignments: [{ slotId: "one", memberId: first.id }] },
      [target]
    ).releasedAssignments
  ).toEqual(removed.releasedAssignments)
  expect(
    removeAssignments(plan, [{ ...target, slotId: "missing" }]).slots
  ).toEqual(plan.slots)
  expect(removed.releasedAssignments).toEqual([
    { slotId: "one", memberId: first.id },
  ])
  expect(removeAssignments(removed, [target]).releasedAssignments).toEqual(
    removed.releasedAssignments
  )
  const result = assignMember(
    removed,
    {
      memberId: first.id,
      slotId: null,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
    },
    []
  )
  // The second active assignment overlaps this time; remove that too before adding.
  expect("error" in result).toBe(true)
  const empty = removeAssignments(removed, [{ ...target, slotId: "two" }])
  const replacement = assignMember(
    empty,
    {
      memberId: first.id,
      slotId: null,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
    },
    []
  )
  if ("error" in replacement) throw new Error(replacement.error)
  expect(replacement.slotId).not.toBe("one")
  expect(replacement.slotId).not.toBe("two")
  expect(
    transferBlocked(
      { ...source, slots: plan.slots },
      {
        ...target,
        slotId: replacement.slotId,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
      },
      Infinity
    )
  ).toBe(false)
  const history = change({ past: [], present: plan, future: [] }, empty)
  expect(undo(history).present).toBe(plan)
  expect(redo(undo(history)).present.releasedAssignments).toEqual(
    empty.releasedAssignments
  )
})
