import { expect, it } from "vite-plus/test"
import { thumbnailWidth } from "@/features/chat/components/image/thumbnail"

it("rests narrow and widens to a square as it comes into view", () => {
  expect(thumbnailWidth(0)).toBe(1.5)
  expect(thumbnailWidth(0.5)).toBe(2.25)
  expect(thumbnailWidth(1)).toBe(3)
})

it("keeps the width between narrow and square", () => {
  expect(thumbnailWidth(-1)).toBe(1.5)
  expect(thumbnailWidth(2)).toBe(3)
})

it("fits ten thumbnails and their gaps in a 320px strip mid-swipe", () => {
  const rem = 16
  const gap = 6
  const widths = Array.from({ length: 10 }, (_, index) =>
    thumbnailWidth(Math.max(0, 1 - Math.abs(4.3 - index)))
  )
  const total = widths.reduce((sum, width) => sum + width * rem, 0) + gap * 9
  expect(total).toBeLessThanOrEqual(320)
})
