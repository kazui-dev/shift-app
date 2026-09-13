import { expect, it } from "vite-plus/test"
import {
  initialImageView,
  limitImageView,
  zoomImage,
} from "@/components/chat/image/zoom"

it("keeps the image point under a moving pinch midpoint", () => {
  const next = zoomImage(
    { scale: 2, x: 20, y: -10 },
    4,
    { x: 40, y: 30 },
    { x: 50, y: 45 }
  )
  expect(next).toEqual({ scale: 4, x: 10, y: -35 })
})

it("caps magnification and prevents dragging the image out of its frame", () => {
  expect(limitImageView({ scale: 10, x: 2000, y: -2000 }, 300, 500)).toEqual({
    scale: 5,
    x: 600,
    y: -1000,
  })
  expect(limitImageView({ scale: 0.5, x: 20, y: -10 }, 300, 500)).toEqual(
    initialImageView
  )
  expect(zoomImage(initialImageView, 10, { x: 10, y: 20 })).toEqual({
    scale: 5,
    x: -40,
    y: -80,
  })
  expect(zoomImage(initialImageView, 0.5, { x: 0, y: 0 })).toEqual(
    initialImageView
  )
})

it("keeps letterboxed images visible and locks axes that still fit", () => {
  expect(
    limitImageView({ scale: 2, x: 999, y: -999 }, 400, 800, 400, 200)
  ).toEqual({ scale: 2, x: 200, y: 0 })
  expect(
    limitImageView({ scale: 2, x: -999, y: 999 }, 800, 400, 200, 400)
  ).toEqual({ scale: 2, x: 0, y: 200 })
})
