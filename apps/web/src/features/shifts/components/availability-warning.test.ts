import { expect, it } from "vite-plus/test"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { hasUnavailableAssignments } from "./availability-warning"

const plan: ActivityEditorInput = {
  requirements: [],
  name: "受付",
  place: "入口",
  activityType: "シフト",
  startsAt: "2026-09-13T09:00:00+09:00",
  endsAt: "2026-09-13T18:00:00+09:00",
  color: "#888888",
  notes: null,
  version: 1,
  active: true,
  candidateRoleIds: [],
  responsibles: [],
  slots: [
    {
      id: "slot",
      startsAt: "2026-09-13T09:00:00+09:00",
      endsAt: "2026-09-13T12:00:00+09:00",
      capacity: null,
      memberIds: ["member"],
    },
  ],
}

it("requires a warning when a saved assignment is no longer fully within availability", () => {
  const available = {
    memberId: "member",
    startsAt: "2026-09-13T09:00:00+09:00",
    endsAt: "2026-09-13T12:00:00+09:00",
  }
  expect(hasUnavailableAssignments(plan, [available])).toBe(false)
  expect(
    hasUnavailableAssignments(plan, [
      { ...available, startsAt: "2026-09-13T10:00:00+09:00" },
    ])
  ).toBe(true)
  expect(hasUnavailableAssignments(plan, [])).toBe(true)
  expect(hasUnavailableAssignments({ ...plan, slots: [] }, [])).toBe(false)
})
