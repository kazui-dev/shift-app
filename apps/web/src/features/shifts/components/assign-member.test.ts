import { expect, it } from "vite-plus/test"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { assignMember } from "./assign-member"

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
  slots: [],
}
const slot = (values: Partial<ActivityEditorInput["slots"][number]>) => ({
  id: "slot",
  startsAt: "2026-09-13T09:00:00+09:00",
  endsAt: "2026-09-13T12:00:00+09:00",
  capacity: null,
  memberIds: ["member"],
  ...values,
})
const window = {
  memberId: "member",
  startsAt: "2026-09-13T09:00:00+09:00",
  endsAt: "2026-09-13T12:00:00+09:00",
}

it("refuses a window outside the shift or one the member already works", () => {
  expect(
    assignMember(
      plan,
      {
        memberId: "member",
        slotId: null,
        startsAt: "2026-09-13T08:00:00+09:00",
        endsAt: "2026-09-13T10:00:00+09:00",
      },
      []
    )
  ).toEqual({ error: "シフトの開始・終了の範囲内で指定してください。" })
  expect(
    assignMember(
      plan,
      {
        memberId: "member",
        slotId: null,
        startsAt: "2026-09-13T11:00:00+09:00",
        endsAt: "2026-09-13T13:00:00+09:00",
      },
      [window]
    )
  ).toEqual({ error: "この時間には別のシフトがあります。" })
  expect(
    assignMember(
      { ...plan, slots: [slot({ id: "other" })] },
      {
        memberId: "member",
        slotId: null,
        startsAt: "2026-09-13T11:00:00+09:00",
        endsAt: "2026-09-13T13:00:00+09:00",
      },
      []
    )
  ).toEqual({ error: "この時間には別のシフトがあります。" })
})

it("merges into a slot that already covers the window and keeps its capacity", () => {
  const destination = slot({
    id: "destination",
    capacity: 3,
    memberIds: ["other"],
  })
  const result = assignMember(
    {
      ...plan,
      slots: [
        destination,
        slot({ id: "from", memberIds: ["member", "extra"] }),
      ],
    },
    {
      memberId: "member",
      slotId: "from",
      startsAt: destination.startsAt,
      endsAt: destination.endsAt,
    },
    []
  )
  if ("error" in result) throw Error(result.error)
  expect(result.slotId).toBe("destination")
  expect(result.slots).toEqual([
    slot({ id: "from", memberIds: ["extra"] }),
    { ...destination, memberIds: ["other", "member"] },
  ])
})

it("reuses a slot the member had to itself and orders slots by start", () => {
  const only = slot({ id: "only", memberIds: ["member"] })
  const result = assignMember(
    { ...plan, slots: [only] },
    {
      memberId: "member",
      slotId: "only",
      startsAt: "2026-09-13T13:00:00+09:00",
      endsAt: "2026-09-13T15:00:00+09:00",
    },
    []
  )
  if ("error" in result) throw Error(result.error)
  expect(result.slotId).toBe("only")
  expect(result.slots).toEqual([
    {
      id: "only",
      startsAt: "2026-09-13T13:00:00+09:00",
      endsAt: "2026-09-13T15:00:00+09:00",
      capacity: null,
      memberIds: ["member"],
    },
  ])
})
