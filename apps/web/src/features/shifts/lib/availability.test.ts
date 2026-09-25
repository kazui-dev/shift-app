import { expect, it } from "vite-plus/test"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import {
  availabilityDuringShift,
  hasAssignmentOutsideAvailability,
} from "./availability"

const plan: ActivityEditorInput = {
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
      startsAt: "2026-09-13T10:00:00+09:00",
      endsAt: "2026-09-13T12:00:00+09:00",
      capacity: null,
      memberIds: ["member"],
    },
  ],
}

it("shows intersecting availability and requires confirmation unless one window covers the assignment", () => {
  const before = {
    memberId: "member",
    startsAt: "2026-09-13T08:00:00+09:00",
    endsAt: "2026-09-13T09:00:00+09:00",
  }
  const partial = {
    memberId: "member",
    startsAt: "2026-09-13T09:00:00+09:00",
    endsAt: "2026-09-13T11:00:00+09:00",
  }
  const covering = {
    memberId: "member",
    startsAt: "2026-09-13T10:00:00+09:00",
    endsAt: "2026-09-13T12:00:00+09:00",
  }
  expect(availabilityDuringShift([before, partial, covering], plan)).toEqual([
    partial,
    covering,
  ])
  expect(hasAssignmentOutsideAvailability(plan, [partial])).toBe(true)
  expect(hasAssignmentOutsideAvailability(plan, [covering])).toBe(false)
})
