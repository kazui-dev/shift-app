import { expect, it } from "vite-plus/test"
import { composerExpanded } from "./use-composer-layout"

it("expands an empty mobile composer on focus and keeps it expanded after sending", () => {
  const rest = {
    mobile: true,
    focused: false,
    content: "",
    previous: false,
    overflowing: false,
  }
  expect(composerExpanded(rest)).toBe(false)
  expect(composerExpanded({ ...rest, focused: true })).toBe(true)
  expect(composerExpanded({ ...rest, focused: true, previous: true })).toBe(
    true
  )
  expect(composerExpanded({ ...rest, previous: true })).toBe(false)
})
it("does not rearrange desktop text just because it receives focus", () => {
  const desktop = {
    mobile: false,
    focused: true,
    content: "hello",
    previous: false,
    overflowing: false,
  }
  expect(composerExpanded(desktop)).toBe(false)
  expect(composerExpanded({ ...desktop, overflowing: true })).toBe(true)
  expect(composerExpanded({ ...desktop, previous: true })).toBe(true)
  expect(composerExpanded({ ...desktop, previous: true, content: "" })).toBe(
    false
  )
})
it("keeps a nonempty draft expanded after leaving focus, including on mobile", () => {
  expect(
    composerExpanded({
      mobile: true,
      focused: false,
      content: "下書き",
      previous: true,
      overflowing: false,
    })
  ).toBe(true)
  expect(
    composerExpanded({
      mobile: true,
      focused: false,
      content: "長い下書き",
      previous: false,
      overflowing: true,
    })
  ).toBe(true)
})
