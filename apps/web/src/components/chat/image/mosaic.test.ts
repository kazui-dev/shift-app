import { expect, it } from "vite-plus/test"
import { mosaic } from "@/components/chat/image/mosaic"

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
