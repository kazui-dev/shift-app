import { describe, expect, it } from "vitest"

import {
  createAnnouncementInputSchema,
  createChatRoomInputSchema,
  pushSubscriptionInputSchema,
  sendChatMessageInputSchema,
} from "./communications"

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

  it("accepts a member-targeted chat room", () => {
    expect(
      createChatRoomInputSchema.parse({
        year: 2026,
        name: "  本部連絡  ",
        targets: [
          {
            targetType: "member",
            targetId: "6632fe2d-1064-442c-8884-3b674f564e60",
          },
        ],
      }).name
    ).toBe("本部連絡")
  })

  it("requires an idempotency id for chat messages", () => {
    expect(
      sendChatMessageInputSchema.safeParse({ content: "了解" }).success
    ).toBe(false)
  })

  it("validates a web push subscription", () => {
    expect(
      pushSubscriptionInputSchema.safeParse({
        endpoint: "https://push.example.test/subscription/1",
        expirationTime: null,
        keys: { p256dh: "public-key", auth: "auth-secret" },
      }).success
    ).toBe(true)
  })
})
