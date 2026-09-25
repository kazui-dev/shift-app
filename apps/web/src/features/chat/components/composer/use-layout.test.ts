import { expect, it } from "vite-plus/test"
import { composerExpanded } from "@/features/chat/components/composer/use-layout"

it("stays on one row until the text overflows beside the controls", () => {
  expect(composerExpanded({ content: "", overflowing: false })).toBe(false)
  expect(composerExpanded({ content: "hello", overflowing: false })).toBe(false)
  expect(composerExpanded({ content: "長い下書き", overflowing: true })).toBe(
    true
  )
})

it("does not expand an empty composer even if its placeholder overflows", () => {
  expect(composerExpanded({ content: "", overflowing: true })).toBe(false)
})
