import { expect, it } from "vite-plus/test"
import {
  frameHeight,
  mosaic,
  singleImageSize,
  tileSizes,
} from "@/features/chat/lib/image-frame"

it("arranges up to ten images in one frame", () => {
  expect(
    Array.from({ length: 11 }, (_, count) => [count, mosaic(count)])
  ).toEqual([
    [0, { split: false, rows: [] }],
    [1, { split: false, rows: [1] }],
    [2, { split: false, rows: [2] }],
    [3, { split: true, rows: [1, 2] }],
    [4, { split: false, rows: [2, 2] }],
    [5, { split: false, rows: [2, 3] }],
    [6, { split: false, rows: [3, 3] }],
    [7, { split: false, rows: [1, 3, 3] }],
    [8, { split: false, rows: [2, 3, 3] }],
    [9, { split: false, rows: [3, 3, 3] }],
    [10, { split: false, rows: [1, 3, 3, 3] }],
  ])
})

it("delivers full-width and tall tiles at 1280 and the rest at 640", () => {
  expect(tileSizes(0)).toEqual([])
  expect(tileSizes(1)).toEqual([1280])
  expect(tileSizes(2)).toEqual([640, 640])
  expect(tileSizes(3)).toEqual([1280, 640, 640])
  expect(tileSizes(7)).toEqual([1280, 640, 640, 640, 640, 640, 640])
})

it("reserves a single image's proportions while capping portrait height", () => {
  expect(singleImageSize({ width: 120, height: 80 })).toEqual({
    width: 120,
    aspectRatio: "120 / 80",
  })
  expect(singleImageSize({ width: 600, height: 1200 })).toEqual({
    width: 160,
    aspectRatio: "600 / 1200",
  })
  expect(singleImageSize()).toEqual({ width: 192, aspectRatio: "192 / 192" })
})

it("measures the frame the history draws for a message's images", () => {
  const photo = { width: 400, height: 300 }
  expect(frameHeight([], 336)).toBe(0)
  expect(frameHeight([photo], 336)).toBe(252)
  expect(frameHeight([photo, photo, photo], 336)).toBe(252)
  // One wide row and two rows of three, with the gaps between them.
  expect(
    frameHeight(
      Array.from({ length: 7 }, () => photo),
      336
    )
  ).toBe(421)
  expect(frameHeight([photo, photo], 1000)).toBe(256)
})
