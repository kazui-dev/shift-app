import { expect, it } from "vite-plus/test"
import { composerExpanded } from "@/components/chat/composer/use-layout"

it("expands an empty mobile composer on focus and keeps it expanded after sending", () => {
  const rest = {
    mobile: true,
    focused: false,
    content: "",
    overflowing: false,
  }
  expect(composerExpanded(rest)).toBe(false)
  expect(composerExpanded({ ...rest, focused: true })).toBe(true)
})
it("does not rearrange desktop text just because it receives focus", () => {
  const desktop = {
    mobile: false,
    focused: true,
    content: "hello",
    overflowing: false,
  }
  expect(composerExpanded(desktop)).toBe(false)
  expect(composerExpanded({ ...desktop, overflowing: true })).toBe(true)
  expect(composerExpanded({ ...desktop, content: "" })).toBe(false)
})
it("collapses a short draft on blur and keeps overflowing text expanded", () => {
  expect(
    composerExpanded({
      mobile: true,
      focused: false,
      content: "下書き",
      overflowing: false,
    })
  ).toBe(false)
  expect(
    composerExpanded({
      mobile: true,
      focused: false,
      content: "長い下書き",
      overflowing: true,
    })
  ).toBe(true)
})
