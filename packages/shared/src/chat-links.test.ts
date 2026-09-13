import { expect, it } from "vite-plus/test"
import { messageLinks } from "./chat-links"
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
