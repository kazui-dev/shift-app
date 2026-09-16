import { QueryClient } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { keys } from "@/data/keys"
import { applyLiveEvent } from "./live-events"

const shift = "10000000-0000-4000-8000-000000000001"
const other = "10000000-0000-4000-8000-000000000002"
const member = "10000000-0000-4000-8000-000000000003"
const face = `https://app.example/api/members/${member}/avatar?v=2`

const post = (id: string, memberId: string) => ({
  id,
  sequence: 1,
  memberId,
  memberDisplayName: memberId,
  memberImage: null,
  content: "本文",
  createdAt: "2026-09-17T00:00:00Z",
  attachments: [],
  linkPreview: null,
  version: 1,
})

function watched() {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, "invalidateQueries")
  const invalidated = () =>
    invalidate.mock.calls.map(([filters]) => filters?.queryKey)
  return { client, invalidate, invalidated }
}

it("refreshes only what each change touches", () => {
  const { client, invalidate, invalidated } = watched()
  applyLiveEvent(
    client,
    { type: "attendance_changed", activityId: shift },
    "me"
  )
  expect(invalidated()).toEqual([
    keys.shiftAttendance(shift),
    keys.attendanceEvents(),
  ])
  invalidate.mockClear()
  applyLiveEvent(client, { type: "availability_submitted", year: 2026 }, "me")
  expect(invalidated()).toEqual([keys.availabilitySubmissions(2026)])
  invalidate.mockClear()
  applyLiveEvent(client, { type: "availability_changed", year: 2026 }, "me")
  expect(invalidated()).toEqual([
    keys.availability(2026),
    keys.availabilityDates(2026),
    keys.availabilitySubmissions(2026),
  ])
  invalidate.mockClear()
  applyLiveEvent(client, { type: "shifts_changed" }, "me")
  expect(invalidated()).toEqual(
    expect.arrayContaining([
      keys.assignments(),
      keys.activities(),
      keys.chatRooms(),
      keys.chatMessages(),
    ])
  )
  expect(invalidated()).not.toContainEqual(keys.activityEditor())
  invalidate.mockClear()
  applyLiveEvent(client, { type: "access_changed" }, "me")
  expect(invalidate).toHaveBeenCalledWith({ predicate: expect.any(Function) })
  invalidate.mockClear()
  applyLiveEvent(client, { type: "room_changed", roomId: shift }, "me")
  expect(invalidated()).toContainEqual(keys.chatRoom(shift))
  client.clear()
})

it("catches up on shifts and chat when the connection reopens", () => {
  const { client, invalidated } = watched()
  applyLiveEvent(client, null, "me")
  expect(invalidated()).toEqual(
    expect.arrayContaining([
      keys.assignments(),
      keys.shiftAttendance(),
      keys.availability(),
      keys.chatMessages(),
    ])
  )
  client.clear()
})

it("shows a changed profile image on cached posts, replies and members without refetching", () => {
  const { client, invalidate } = watched()
  const messages = keys.chatMessages(shift)
  const members = keys.chatMembers(shift)
  client.setQueryData(messages, {
    pages: [
      {
        messages: [
          post("mine", member),
          { ...post("reply", other), reply: { ...post("mine", member) } },
          post("theirs", other),
        ],
        hasMore: false,
      },
    ],
    pageParams: [null],
  })
  client.setQueryData(members, {
    members: [
      { id: member, displayName: member, canManage: false, image: null },
      { id: other, displayName: "other", canManage: false, image: null },
    ],
  })
  applyLiveEvent(
    client,
    { type: "profile_changed", memberId: member, image: face },
    "me"
  )
  expect(client.getQueryData(messages)).toMatchObject({
    pages: [
      {
        messages: [
          { memberImage: face },
          { memberImage: null, reply: { memberImage: face } },
          { memberImage: null },
        ],
      },
    ],
  })
  expect(client.getQueryData(members)).toMatchObject({
    members: [{ image: face }, { image: null }],
  })
  expect(invalidate).not.toHaveBeenCalled()
  client.clear()
})
