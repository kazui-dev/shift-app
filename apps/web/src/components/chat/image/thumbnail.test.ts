import { expect, it } from "vite-plus/test"
import { thumbnailWidth } from "@/components/chat/image/thumbnail"

it("rests narrow and widens to the image's proportions as it comes into view", () => {
  const landscape = { width: 1600, height: 900 }
  expect(thumbnailWidth(landscape, 0)).toBe(2.25)
  expect(thumbnailWidth(landscape, 1)).toBeCloseTo(6.222, 3)
  expect(thumbnailWidth(landscape, 0.5)).toBeCloseTo(4.236, 3)
})

it("keeps very wide or tall images within the strip's bounds", () => {
  expect(thumbnailWidth({ width: 4000, height: 500 }, 1)).toBe(7)
  expect(thumbnailWidth({ width: 500, height: 4000 }, 1)).toBe(2.25)
  expect(thumbnailWidth({ width: 1600, height: 900 }, 2)).toBeCloseTo(6.222, 3)
  expect(thumbnailWidth({ width: 1600, height: 900 }, -1)).toBe(2.25)
})
