import { expect, it } from "vite-plus/test"
import { messageRows } from "./message-list"
import type { QueuedMessage } from "@/lib/chat-store"
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
