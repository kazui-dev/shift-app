import { beforeEach, expect, it, vi } from "vite-plus/test"
import type {
  ActivityEditorInput,
  ShiftOverview,
} from "@workspace/shared/shifts"
import type { EditorData } from "../editor-data"
import { projectOverview, mergeOverviewDraft } from "./overview-draft"
import { saveOverviewDrafts } from "./save-overview-drafts"
import { getActivity, saveActivity } from "../api/activities"
import { ApiError } from "@/lib/http/client"
import { change, undo, redo } from "./editor-history"
vi.mock("../api/activities", () => ({
  getActivity: vi.fn<typeof getActivity>(),
  saveActivity: vi.fn<typeof saveActivity>(),
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

it("replaces a concurrent move of the same member but retains other members", () => {
  const shared = {
    ...base,
    slots: base.slots.map((slot) => ({ ...slot, memberIds: ["a", "b"] })),
  }
  const ours = {
    ...shared,
    slots: [
      {
        ...plan.slots[0],
        id: "moved",
        startsAt: "2026-11-01T03:00:00Z",
        endsAt: "2026-11-01T04:00:00Z",
        capacity: null,
        memberIds: ["a"],
      },
      ...shared.slots.map((slot) => ({ ...slot, memberIds: ["b"] })),
    ],
  }
  const latest = {
    ...shared,
    version: 3,
    slots: [
      ...shared.slots.map((slot) => ({ ...slot, memberIds: ["b", "c"] })),
      {
        id: "remote",
        startsAt: "2026-11-01T05:00:00Z",
        endsAt: "2026-11-01T06:00:00Z",
        capacity: null,
        memberIds: ["a"],
      },
    ],
  }
  const merged = mergeOverviewDraft({ base: shared, plan: ours }, latest)
  expect(merged.slots.filter((s) => s.memberIds.includes("a"))).toEqual([
    expect.objectContaining({ startsAt: "2026-11-01T03:00:00Z" }),
  ])
  expect(merged.slots.find((s) => s.id === "s")?.memberIds).toEqual(["b", "c"])
  expect(merged.version).toBe(3)
  const sameWindow = mergeOverviewDraft(
    { base, plan },
    {
      ...latest,
      slots: [
        ...latest.slots,
        {
          ...plan.slots[0],
          id: "destination",
          startsAt: "2026-11-01T03:00:00Z",
          endsAt: "2026-11-01T04:00:00Z",
          capacity: null,
          memberIds: ["c"],
        },
      ],
    }
  )
  expect(
    sameWindow.slots.find((s) => s.id === "destination")?.memberIds
  ).toEqual(["c", "a"])
  const collision = mergeOverviewDraft(
    {
      base,
      plan: { ...plan, slots: plan.slots.map((s) => ({ ...s, id: "s" })) },
    },
    latest
  )
  expect(
    collision.slots.filter((s) => s.memberIds.includes("a"))[0]?.id
  ).not.toBe("s")
})
