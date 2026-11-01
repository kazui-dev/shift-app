import { beforeEach, expect, it, vi } from "vite-plus/test"
import type {
  ActivityEditorInput,
  ShiftOverview,
} from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import { projectOverview } from "./overview-draft"
import { mergeActivityDraft } from "./save-activity-drafts"
import { saveOverviewDrafts } from "./save-overview-drafts"
import {
  getActivity,
  saveActivity,
  reviewActivityOverlaps,
  overwriteActivity,
  saveActivityPlans,
} from "../api/activities"
import { ApiError } from "@/lib/http/client"
import { change, undo, redo } from "./editor-history"
vi.mock("../api/activities", () => ({
  getActivity: vi.fn<typeof getActivity>(),
  saveActivityPlans: vi.fn<typeof saveActivityPlans>(),
  saveActivity: vi.fn<typeof saveActivity>(),
  reviewActivityOverlaps: vi.fn<typeof reviewActivityOverlaps>(),
  overwriteActivity: vi.fn<typeof overwriteActivity>(),
}))
const base: ActivityEditorInput = {
  version: 1,
  name: "受付",
  place: "入口",
  activityType: "shift",
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-11-01T09:00:00Z",
  color: "#000000",
  notes: null,
  active: true,
  responsibles: [],
  candidateRoleIds: [],
  requirements: [],
  slots: [
    {
      id: "s",
      startsAt: "2026-11-01T00:00:00Z",
      endsAt: "2026-11-01T02:00:00Z",
      capacity: null,
      memberIds: ["a"],
    },
  ],
}
const source: EditorData = {
  activity: { ...base, id: "work", year: 2026 },
  slots: base.slots,
  requirements: [],
  candidateRoleIds: [],
  responsibles: [],
  members: [],
  roles: [],
  availability: [],
  availabilityAnswers: [],
  otherAssignments: [],
  submittedMemberIds: [],
}
const plan = {
  ...base,
  slots: [
    {
      ...base.slots[0],
      id: "new",
      startsAt: "2026-11-01T03:00:00Z",
      endsAt: "2026-11-01T04:00:00Z",
      capacity: null,
      memberIds: ["a"],
    },
  ],
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getActivity).mockResolvedValue(source)
  vi.mocked(saveActivity).mockResolvedValue(source)
})
it("projects edits without saving, retains attendance, and supports undo/redo", () => {
  const data: ShiftOverview = {
    canEdit: true,
    members: [],
    roles: [],
    availability: [],
    availabilityAnswers: [],
    activities: [
      {
        id: "work",
        name: base.name,
        color: base.color,
        active: true,
        startsAt: base.startsAt,
        endsAt: base.endsAt,
      },
    ],
    assignments: [
      {
        id: "a",
        activityId: "work",
        slotId: "s",
        memberId: "a",
        startsAt: base.startsAt,
        endsAt: base.endsAt,
        attendance: null,
      },
      {
        id: "b",
        activityId: "other",
        slotId: "other",
        memberId: "b",
        startsAt: base.startsAt,
        endsAt: base.endsAt,
        attendance: null,
      },
    ],
  }
  expect(
    projectOverview(data, { work: { base, plan: base } }).assignments
  ).toEqual(expect.arrayContaining([expect.objectContaining({ id: "a" })]))
  const projected = projectOverview(data, {
    work: { base, plan },
    hidden: { base, plan },
  })
  expect(projected.assignments).toHaveLength(2)
  expect(projected.assignments).toContainEqual(
    expect.objectContaining({ slotId: "new", memberId: "a" })
  )
  expect(
    projectOverview(data, {
      work: { base, plan: { ...base, slots: [] } },
    }).assignments.map((a) => a.id)
  ).toEqual(["b"])
  const history = change(
    { past: [], present: {}, future: [] },
    { work: { base, plan } }
  )
  expect(undo(history).present).toEqual({})
  expect(redo(undo(history)).present).toEqual(history.present)
  expect(saveActivity).not.toHaveBeenCalled()
})
it("saves only changed activities and preserves independent server edits", async () => {
  vi.mocked(getActivity).mockResolvedValue({
    ...source,
    activity: { ...source.activity, version: 2, place: "正門" },
  })
  const result = await saveOverviewDrafts({ work: { base, plan } })
  expect(saveActivity).toHaveBeenCalledWith(
    "work",
    expect.objectContaining({
      version: 2,
      place: "正門",
      slots: [{ ...base.slots[0], memberIds: [] }, ...plan.slots],
    })
  )
  expect(result.remaining).toEqual({})
  expect(result.confirmed).toHaveLength(1)
})
it("keeps failed drafts and does not resubmit successful work on retry", async () => {
  vi.mocked(saveActivity)
    .mockResolvedValueOnce(source)
    .mockRejectedValueOnce(new Error("offline"))
  const result = await saveOverviewDrafts({
    work: { base, plan },
    failed: { base, plan },
  })
  expect(Object.keys(result.remaining)).toEqual(["failed"])
  expect(result.failures).toHaveLength(1)
  vi.mocked(saveActivity).mockResolvedValue(source)
  await saveOverviewDrafts(result.remaining)
  expect(vi.mocked(saveActivity).mock.calls.map((call) => call[0])).toEqual([
    "work",
    "failed",
    "failed",
  ])
})
it("retries version races but keeps the draft if all attempts fail", async () => {
  vi.mocked(saveActivity).mockRejectedValue(
    new ApiError("changed", 409, "SHIFT_CHANGED")
  )
  const result = await saveOverviewDrafts({ work: { base, plan } })
  expect(saveActivity).toHaveBeenCalledTimes(3)
  expect(result.remaining.work).toEqual({ base, plan })
})
it("keeps a draft when the latest plan cannot be loaded", async () => {
  vi.mocked(getActivity).mockRejectedValue(new Error("offline"))
  expect(
    (await saveOverviewDrafts({ work: { base, plan } })).failures
  ).toHaveLength(1)
  expect(saveActivity).not.toHaveBeenCalled()
})

it("rejects conflicting moves of the same assignment and retains independent people", () => {
  const shared = {
    ...base,
    slots: base.slots.map((slot) => ({ ...slot, memberIds: ["a", "b"] })),
  }
  const ours = {
    ...shared,
    slots: [
      ...plan.slots,
      ...shared.slots.map((slot) => ({ ...slot, memberIds: ["b"] })),
    ],
  }
  const latest = {
    ...shared,
    version: 3,
    slots: [
      ...shared.slots.map((slot) => ({ ...slot, memberIds: ["b", "c"] })),
      ...plan.slots.map((slot) => ({
        ...slot,
        id: "remote",
        startsAt: "2026-11-01T05:00:00Z",
        endsAt: "2026-11-01T06:00:00Z",
      })),
    ],
  }
  expect(() =>
    mergeActivityDraft({ base: shared, plan: ours }, latest)
  ).toThrow("競合")
  const independent = {
    ...latest,
    slots: shared.slots.map((slot) => ({
      ...slot,
      memberIds: ["a", "b", "c"],
    })),
  }
  const merged = mergeActivityDraft({ base: shared, plan: ours }, independent)
  expect(merged.slots.find((slot) => slot.id === "s")?.memberIds).toEqual([
    "b",
    "c",
  ])
  expect(merged.slots.find((slot) => slot.id === "new")?.memberIds).toEqual([
    "a",
  ])
  expect(merged.version).toBe(3)
})

const overlapReview = {
  token: "a".repeat(64),
  changes: [
    {
      assignmentId: "old",
      activityId: "other",
      activityName: "会場案内",
      memberId: "a",
      memberName: "佐藤 葵",
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      remaining: [],
      blockedReason: null,
    },
  ],
}
it("uses the same authoritative overlap review and saves only after confirmation", async () => {
  vi.mocked(saveActivity).mockRejectedValue(
    new ApiError("overlap", 409, "SHIFT_OVERLAP")
  )
  vi.mocked(reviewActivityOverlaps).mockResolvedValue(overlapReview)
  vi.mocked(overwriteActivity).mockResolvedValue(source)
  const confirm = vi
    .fn<() => Promise<boolean>>()
    .mockImplementation(async () => {
      expect(overwriteActivity).not.toHaveBeenCalled()
      return true
    })
  const result = await saveOverviewDrafts({ work: { base, plan } }, confirm)
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "work",
      review: overlapReview,
      plan: expect.objectContaining({ version: 1 }),
    })
  )
  expect(overwriteActivity).toHaveBeenCalledWith(
    "work",
    expect.objectContaining({ slots: expect.arrayContaining(plan.slots) }),
    overlapReview.token
  )
  expect(result.remaining).toEqual({})
  expect(result.confirmed).toHaveLength(1)
})
it("cancels without writing the overlapping shift and stops remaining drafts", async () => {
  vi.mocked(saveActivity).mockRejectedValue(
    new ApiError("overlap", 409, "SHIFT_OVERLAP")
  )
  vi.mocked(reviewActivityOverlaps).mockResolvedValue(overlapReview)
  const drafts = { work: { base, plan }, next: { base, plan } }
  const result = await saveOverviewDrafts(drafts, async () => false)
  expect(result.cancelled).toBe(true)
  expect(result.remaining).toEqual(drafts)
  expect(result.failures).toEqual([])
  expect(overwriteActivity).not.toHaveBeenCalled()
  expect(getActivity).toHaveBeenCalledTimes(1)
})
it("rechecks changed overlaps and requires a fresh confirmation", async () => {
  vi.mocked(saveActivity).mockRejectedValue(
    new ApiError("overlap", 409, "SHIFT_OVERLAP")
  )
  vi.mocked(getActivity)
    .mockResolvedValueOnce(source)
    .mockResolvedValue({
      ...source,
      activity: { ...source.activity, version: 2 },
    })
  vi.mocked(reviewActivityOverlaps)
    .mockResolvedValueOnce(overlapReview)
    .mockResolvedValue({ ...overlapReview, token: "b".repeat(64) })
  vi.mocked(overwriteActivity)
    .mockRejectedValueOnce(
      new ApiError("changed", 409, "ASSIGNMENT_OVERWRITE_CHANGED")
    )
    .mockResolvedValue(source)
  const confirm = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)
  const result = await saveOverviewDrafts({ work: { base, plan } }, confirm)
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(overwriteActivity).toHaveBeenLastCalledWith(
    "work",
    expect.objectContaining({ version: 2 }),
    "b".repeat(64)
  )
  expect(result.remaining).toEqual({})
})
it("saves directly if an overlap disappeared before review and retains failures for retry", async () => {
  vi.mocked(saveActivity).mockRejectedValue(
    new ApiError("overlap", 409, "SHIFT_OVERLAP")
  )
  vi.mocked(reviewActivityOverlaps).mockResolvedValue({
    ...overlapReview,
    changes: [],
  })
  vi.mocked(overwriteActivity).mockRejectedValue(new Error("offline"))
  const confirm = vi.fn<() => Promise<boolean>>()
  const result = await saveOverviewDrafts({ work: { base, plan } }, confirm)
  expect(confirm).not.toHaveBeenCalled()
  expect(result.remaining.work).toEqual({ base, plan })
  expect(result.failures).toHaveLength(1)
})

it("retains only unsaved work after cancellation and never resubmits earlier successful shifts", async () => {
  vi.mocked(saveActivity)
    .mockResolvedValueOnce(source)
    .mockRejectedValue(new ApiError("overlap", 409, "SHIFT_OVERLAP"))
  vi.mocked(reviewActivityOverlaps).mockResolvedValue(overlapReview)
  const result = await saveOverviewDrafts(
    { first: { base, plan }, second: { base, plan }, third: { base, plan } },
    async () => false
  )
  expect(result.confirmed.map((item) => item.id)).toEqual(["first"])
  expect(Object.keys(result.remaining)).toEqual(["second", "third"])
  expect(getActivity).toHaveBeenCalledTimes(2)
  expect(overwriteActivity).not.toHaveBeenCalled()
})

it("merges independent changes and retries an atomic release after a version race", async () => {
  const removed = {
    ...plan,
    releasedAssignments: [{ slotId: "s", memberId: "a" }],
  }
  const drafts = { work: { base, plan: removed } }
  vi.mocked(getActivity).mockResolvedValue({
    ...source,
    activity: { ...source.activity, version: 2, place: "正門" },
    slots: base.slots.map((slot) => ({ ...slot, memberIds: ["a", "b"] })),
  })
  vi.mocked(saveActivityPlans)
    .mockRejectedValueOnce(
      new ApiError("更新されています", 409, "SHIFT_CHANGED")
    )
    .mockResolvedValueOnce({ activities: [source] })
  const saved = await saveOverviewDrafts(drafts)
  expect(saved.remaining).toEqual({})
  expect(saveActivityPlans).toHaveBeenCalledTimes(2)
  expect(saveActivity).not.toHaveBeenCalled()
  expect(
    vi.mocked(saveActivityPlans).mock.calls[1]?.[0][0]?.plan
  ).toMatchObject({
    version: 2,
    place: "正門",
    releasedAssignments: removed.releasedAssignments,
    slots: [
      expect.objectContaining({ id: "s", memberIds: ["b"] }),
      ...plan.slots,
    ],
  })
})

it("keeps every atomic draft without writing when the same assignment changed", async () => {
  const removed = {
    ...plan,
    releasedAssignments: [{ slotId: "s", memberId: "a" }],
  }
  const drafts = {
    work: { base, plan: removed },
    other: { base, plan, atomic: true },
  }
  vi.mocked(getActivity).mockResolvedValue({
    ...source,
    slots: base.slots.map((slot) => ({
      ...slot,
      endsAt: "2026-11-01T01:00:00Z",
    })),
  })
  const result = await saveOverviewDrafts(drafts)
  expect(result.remaining).toEqual(drafts)
  expect(result.failures).toHaveLength(1)
  expect(saveActivityPlans).not.toHaveBeenCalled()
  expect(saveActivity).not.toHaveBeenCalled()
})
