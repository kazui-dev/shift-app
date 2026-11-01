import { beforeEach, expect, it, vi } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import { getActivity, saveActivity, saveActivityPlans } from "../api/activities"
import { ApiError } from "@/lib/http/client"
import { planOf } from "./use-shift-plan"
import {
  mergeActivityDraft,
  saveActivityDraft,
  saveActivityDrafts,
} from "./save-activity-drafts"

vi.mock("../api/activities", () => ({
  getActivity: vi.fn<typeof getActivity>(),
  saveActivity: vi.fn<typeof saveActivity>(),
  saveActivityPlans: vi.fn<typeof saveActivityPlans>(),
}))
const fixture = makeEditors()[0]
const first = fixture?.slots[0]
if (!fixture || !first) throw new Error("fixture")
const slot = { ...first, memberIds: ["a"] }
const source = { ...fixture, slots: [slot] }
const base = planOf(source)
const removed = {
  ...base,
  slots: [{ ...slot, memberIds: [] }],
  releasedAssignments: [{ slotId: slot.id, memberId: "a" }],
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getActivity).mockResolvedValue(source)
  vi.mocked(saveActivity).mockResolvedValue(source)
  vi.mocked(saveActivityPlans).mockResolvedValue({ activities: [source] })
})
it("saves against a newer version while retaining another member and settings", async () => {
  vi.mocked(getActivity).mockResolvedValue({
    ...source,
    activity: { ...source.activity, version: 5, place: "new place" },
    slots: [{ ...slot, memberIds: ["a", "b"] }],
  })
  await saveActivityDraft(source.activity.id, { base, plan: removed })
  expect(saveActivity).toHaveBeenCalledExactlyOnceWith(
    source.activity.id,
    expect.objectContaining({
      version: 5,
      place: "new place",
      releasedAssignments: removed.releasedAssignments,
      slots: [{ ...slot, memberIds: ["b"] }],
    })
  )
})
it.each(["single", "atomic"])(
  "does not write a conflicting remove versus time change (%s)",
  async (mode) => {
    vi.mocked(getActivity).mockResolvedValue({
      ...source,
      slots: [{ ...slot, endsAt: "2026-11-01T03:00:00.000Z" }],
    })
    const draft = { base, plan: removed }
    await expect(
      mode === "single"
        ? saveActivityDraft(source.activity.id, draft)
        : saveActivityDrafts({ [source.activity.id]: draft })
    ).rejects.toThrow("競合")
    expect(saveActivity).not.toHaveBeenCalled()
    expect(saveActivityPlans).not.toHaveBeenCalled()
  }
)
it("merges independent assignments of the same person and identical edits", () => {
  const second = {
    ...slot,
    id: "second",
    startsAt: "2026-11-01T05:00:00.000Z",
    endsAt: "2026-11-01T06:00:00.000Z",
  }
  const original = { ...base, slots: [slot, second] }
  const local = {
    ...original,
    slots: [{ ...slot, startsAt: "2026-11-01T00:30:00.000Z" }, second],
  }
  const latest = {
    ...original,
    slots: [slot, { ...second, endsAt: "2026-11-01T07:00:00.000Z" }],
  }
  expect(
    mergeActivityDraft({ base: original, plan: local }, latest).slots
  ).toEqual([local.slots[0], latest.slots[1]])
  expect(
    mergeActivityDraft({ base: original, plan: local }, local).slots
  ).toEqual(local.slots)
})
it("rejects conflicting field changes without touching the server", async () => {
  vi.mocked(getActivity).mockResolvedValue({
    ...source,
    activity: { ...source.activity, name: "theirs" },
  })
  await expect(
    saveActivityDraft(source.activity.id, {
      base,
      plan: { ...base, name: "ours" },
    })
  ).rejects.toThrow("競合")
  expect(saveActivity).not.toHaveBeenCalled()
})
it("recompares after a transactional race and stops if it now conflicts", async () => {
  vi.mocked(getActivity)
    .mockResolvedValueOnce(source)
    .mockResolvedValue({
      ...source,
      slots: [{ ...slot, endsAt: "2026-11-01T03:00:00.000Z" }],
    })
  vi.mocked(saveActivityPlans).mockRejectedValueOnce(
    new ApiError("changed", 409, "ASSIGNMENT_TRANSFER_CHANGED")
  )
  await expect(
    saveActivityDrafts({ [source.activity.id]: { base, plan: removed } })
  ).rejects.toThrow("競合")
  expect(saveActivityPlans).toHaveBeenCalledOnce()
})
it("bounds repeated races and does not retry non-concurrency failures", async () => {
  vi.mocked(saveActivityPlans).mockRejectedValue(
    new ApiError("changed", 409, "SHIFT_CHANGED")
  )
  await expect(
    saveActivityDrafts({ [source.activity.id]: { base, plan: removed } })
  ).rejects.toThrow("changed")
  expect(saveActivityPlans).toHaveBeenCalledTimes(3)
  vi.mocked(saveActivityPlans)
    .mockReset()
    .mockRejectedValue(new Error("offline"))
  await expect(
    saveActivityDrafts({ [source.activity.id]: { base, plan: removed } })
  ).rejects.toThrow("offline")
  expect(saveActivityPlans).toHaveBeenCalledOnce()
})

it("coalesces identical concurrent additions without duplicating an assignment", () => {
  const local = {
    ...base,
    slots: [
      { ...slot, memberIds: [] },
      {
        ...slot,
        id: "ours",
        startsAt: "2026-11-01T05:00:00.000Z",
        endsAt: "2026-11-01T06:00:00.000Z",
      },
    ],
  }
  const latest = {
    ...local,
    slots: local.slots.map((item) =>
      item.id === "ours" ? { ...item, id: "theirs" } : item
    ),
  }
  const merged = mergeActivityDraft({ base, plan: local }, latest)
  expect(merged.slots.filter((item) => item.memberIds.includes("a"))).toEqual([
    latest.slots[1],
  ])
})
