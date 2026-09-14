import { expect, it } from "vite-plus/test"
import {
  groupedWithPrevious,
  messageRows,
  unreadMessage,
  type MessageRow,
} from "@/components/chat/message/list"
import type { QueuedMessage } from "@/lib/chat/store"
const member = {
  id: "member",
  displayName: "名前",
  image: "https://cdn.discordapp.com/embed/avatars/0.png",
}
const queued: QueuedMessage = {
  id: "message",
  roomId: "room",
  content: "本文",
  files: [],
  status: "sending",
  createdAt: "2026-09-11T00:00:00Z",
}
it("uses the same identity, author and text before and after confirmation", () => {
  const pending = messageRows([], [queued], member)[0]
  const confirmed = messageRows(
    [
      {
        id: queued.id,
        sequence: 1,
        memberId: member.id,
        memberDisplayName: member.displayName,
        memberImage: member.image,
        content: queued.content,
        attachments: [],
        linkPreview: null,
        version: 1,
        createdAt: queued.createdAt,
      },
    ],
    [queued],
    member
  )
  expect(confirmed).toHaveLength(1)
  expect(confirmed[0]).toMatchObject({
    id: pending?.id,
    memberId: pending?.memberId,
    memberDisplayName: pending?.memberDisplayName,
    memberImage: pending?.memberImage,
    content: pending?.content,
    createdAt: pending?.createdAt,
    status: "sent",
  })
})
it("keeps failed messages in the same list for retry", () => {
  expect(
    messageRows([], [{ ...queued, status: "failed" }], member)
  ).toMatchObject([
    { id: queued.id, content: queued.content, status: "failed" },
  ])
})

it("hides tombstones without reintroducing their queued copy or hiding replies", () => {
  const deleted = {
    id: queued.id,
    sequence: 1,
    memberId: member.id,
    memberDisplayName: member.displayName,
    memberImage: member.image,
    content: "",
    attachments: [],
    linkPreview: null,
    version: 1,
    createdAt: queued.createdAt,
    deleted: true,
  }
  const reply = {
    ...deleted,
    id: "reply",
    sequence: 2,
    content: "返信",
    deleted: false,
    reply: {
      id: deleted.id,
      sequence: 1,
      memberDisplayName: member.displayName,
      content: "",
      deleted: true,
    },
  }
  expect(messageRows([deleted, reply], [queued], member)).toMatchObject([
    { id: "reply", reply: { deleted: true } },
  ])
})

it("anchors unread history on the next visible message after a deleted sequence", () => {
  const rows = messageRows(
    [1, 2, 3].map((sequence) => ({
      id: String(sequence),
      sequence,
      memberId: member.id,
      memberDisplayName: member.displayName,
      memberImage: member.image,
      content: "本文",
      attachments: [],
      linkPreview: null,
      version: 1,
      createdAt: queued.createdAt,
      deleted: sequence === 2,
    })),
    [queued],
    member
  )
  expect(unreadMessage(rows, 1)?.sequence).toBe(3)
  expect(unreadMessage(rows, 3)).toBeUndefined()
  expect(unreadMessage(rows, 0)).toBeUndefined()
})

it("retains a deleting row through confirmation fade even when the server has already deleted it", () => {
  const original = {
    id: queued.id,
    sequence: 1,
    memberId: member.id,
    memberDisplayName: member.displayName,
    memberImage: member.image,
    content: queued.content,
    attachments: [],
    linkPreview: null,
    version: 1,
    createdAt: queued.createdAt,
  }
  const retained = messageRows([original], [], member)[0]
  if (!retained) throw Error("Missing original row")
  const deleted = { ...original, deleted: true, content: "", attachments: [] }
  expect(messageRows([deleted], [], member, retained)).toEqual([retained])
  expect(messageRows([deleted], [], member, null)).toEqual([])
})

const row = (values: Partial<MessageRow>): MessageRow => ({
  id: "id",
  sequence: 1,
  memberId: member.id,
  memberDisplayName: member.displayName,
  memberImage: member.image,
  content: "本文",
  attachments: [],
  linkPreview: null,
  version: 1,
  files: [],
  status: "sent",
  createdAt: "2026-09-11T01:00:00+09:00",
  ...values,
})

it("starts a new block on a new day, a new author, a gap, a reply, a deletion or the unread mark", () => {
  const previous = row({ id: "previous" })
  const near = row({ id: "near", createdAt: "2026-09-11T01:04:00+09:00" })
  expect(groupedWithPrevious(near, previous, false)).toEqual({
    newDay: false,
    grouped: true,
  })
  expect(groupedWithPrevious(near, undefined, false)).toEqual({
    newDay: true,
    grouped: false,
  })
  expect(groupedWithPrevious(near, previous, true).grouped).toBe(false)
  for (const values of [
    { createdAt: "2026-09-11T01:06:00+09:00" },
    { memberId: "other" },
    { reply: { id: "r", sequence: 0, memberDisplayName: "名前", content: "" } },
    { deleted: true },
  ])
    expect(
      groupedWithPrevious(row({ ...values }), previous, false).grouped
    ).toBe(false)
  expect(groupedWithPrevious(near, row({ deleted: true }), false).grouped).toBe(
    false
  )
  expect(
    groupedWithPrevious(
      row({ createdAt: "2026-09-12T00:30:00+09:00" }),
      previous,
      false
    )
  ).toEqual({ newDay: true, grouped: false })
})
