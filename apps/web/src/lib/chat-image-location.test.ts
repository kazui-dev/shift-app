import { expect, it } from "vite-plus/test"
import { chatImageLocation } from "./chat-image-location"

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
