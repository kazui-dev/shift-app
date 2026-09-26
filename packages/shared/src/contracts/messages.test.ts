import { expect, it } from "vite-plus/test"
import { messageLinks, messagePermissions } from "./messages"
const base = {
  memberId: "me",
  authorId: "other",
  canPost: true,
  canManage: false,
  deleted: false,
}
it("limits editing to the author and permits room managers to delete", () => {
  expect(messagePermissions(base)).toEqual({
    reply: true,
    edit: false,
    delete: false,
  })
  expect(messagePermissions({ ...base, authorId: "me" })).toEqual({
    reply: true,
    edit: true,
    delete: true,
  })
  expect(messagePermissions({ ...base, canManage: true })).toEqual({
    reply: true,
    edit: false,
    delete: true,
  })
  expect(
    messagePermissions({ ...base, authorId: "me", canPost: false })
  ).toEqual({ reply: false, edit: false, delete: true })
  expect(
    messagePermissions({
      ...base,
      authorId: "me",
      canManage: true,
      deleted: true,
    })
  ).toEqual({ reply: false, edit: false, delete: false })
  // A bot's notice is the record of what happened; it may be answered only.
  expect(
    messagePermissions({ ...base, authorId: "bot", canManage: true, bot: true })
  ).toEqual({ reply: true, edit: false, delete: false })
})
it("links http URLs without swallowing surrounding punctuation or Japanese delimiters", () => {
  const text =
    "案内「https://example.com/a?q=1&b=2」。 (https://example.com/wiki/A_(B)). https://example.com/end]"
  const parts = messageLinks(text)
  expect(parts.map((part) => part.text).join("")).toBe(text)
  expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual([
    "https://example.com/a?q=1&b=2",
    "https://example.com/wiki/A_(B)",
    "https://example.com/end",
  ])
})
it("keeps malformed, credential-bearing and non-HTTP text inert", () => {
  for (const text of [
    "plain text",
    "javascript:alert(1)",
    "https://[",
    "https://user:secret@example.com",
    "https://example.com/" + "x".repeat(2048),
    "",
  ])
    expect(messageLinks(text).some((part) => part.href)).toBe(false)
  expect(messageLinks("HTTP://example.com")).toEqual([
    { text: "HTTP://example.com", href: "http://example.com/", offset: 0 },
  ])
})
