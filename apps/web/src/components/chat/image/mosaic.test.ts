import { expect, it } from "vite-plus/test"
import { mosaic, tileSizes } from "@/components/chat/image/mosaic"

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
