import { expect, it } from "vite-plus/test"
import { adjacentImages, chatImageLocation } from "@/lib/chat/image-location"

it("requires a complete image location with a safe message sequence", () => {
  const image = "10000000-0000-4000-8000-000000000001"
  expect(chatImageLocation({ image, message: "12" })).toEqual({
    image,
    message: 12,
  })
  expect(chatImageLocation({ image, message: 12 })).toEqual({
    image,
    message: 12,
  })
  for (const message of [
    undefined,
    null,
    true,
    {},
    -1,
    0,
    1.5,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    "1&limit=100",
  ])
    expect(chatImageLocation({ image, message })).toEqual({})
  expect(chatImageLocation({ image: "invalid", message: 1 })).toEqual({})
})

it("finds the neighbouring images within one message", () => {
  expect(adjacentImages(["a", "b", "c"], "a")).toEqual({
    index: 0,
    previous: undefined,
    next: "b",
  })
  expect(adjacentImages(["a", "b", "c"], "c")).toEqual({
    index: 2,
    previous: "b",
    next: undefined,
  })
  expect(adjacentImages(["a"], "missing")).toEqual({
    index: -1,
    previous: undefined,
    next: undefined,
  })
})
