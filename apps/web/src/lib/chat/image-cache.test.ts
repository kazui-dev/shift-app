import { expect, it } from "vite-plus/test"
import { staleImages, type CachedImage } from "@/lib/chat/image-cache"

const day = 86_400_000
const entry = (key: string, used: number, bytes = 1): CachedImage => ({
  key,
  user: "user",
  room: "room",
  id: key,
  variant: "640",
  bytes,
  used,
})

it("drops images unused for longer than the age limit", () => {
  const now = 30 * day
  expect(
    staleImages(
      [entry("old", now - 15 * day), entry("recent", now - day)],
      now,
      { bytes: 100, age: 14 * day }
    )
  ).toEqual(["old"])
})

it("drops the least recently used images once the rest exceed the space", () => {
  const now = day
  const images = [
    entry("oldest", 1, 40),
    entry("newest", 3, 40),
    entry("middle", 2, 40),
  ]
  expect(staleImages(images, now, { bytes: 80, age: day })).toEqual(["oldest"])
  expect(staleImages(images, now, { bytes: 40, age: day })).toEqual([
    "middle",
    "oldest",
  ])
  expect(staleImages(images, now, { bytes: 120, age: day })).toEqual([])
})
