import { describe, expect, it } from "vitest"

import { createAnnouncementInputSchema } from "./communications"

describe("communication schemas", () => {
  it("normalizes announcement input", () => {
    expect(
      createAnnouncementInputSchema.parse({
        title: "  集合場所の変更  ",
        body: "正門ではなく本部へ集合してください。",
        priority: "important",
      })
    ).toEqual({
      title: "集合場所の変更",
      body: "正門ではなく本部へ集合してください。",
      priority: "important",
      expiresAt: null,
    })
  })

  it("rejects an empty announcement", () => {
    expect(
      createAnnouncementInputSchema.safeParse({ title: "", body: "" }).success
    ).toBe(false)
  })
})
