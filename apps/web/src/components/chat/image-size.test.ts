import { expect, it } from "vite-plus/test"
import { imageSize } from "./image-size"

it("reserves intrinsic image proportions while capping portrait height", () => {
  expect(imageSize({ width: 120, height: 80 })).toEqual({
    width: 120,
    aspectRatio: "120 / 80",
  })
  expect(imageSize({ width: 600, height: 1200 })).toEqual({
    width: 160,
    aspectRatio: "600 / 1200",
  })
  expect(imageSize()).toEqual({ width: 192, aspectRatio: "192 / 192" })
})
