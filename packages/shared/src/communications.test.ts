import * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"

import {
  createAnnouncementInputSchema,
  createChatRoomInputSchema,
  pushSubscriptionInputSchema,
  sendChatMessageInputSchema,
} from "./communications"

describe("communication schemas", () => {
  it("normalizes announcement input", () => {
    expect(
      v.parse(createAnnouncementInputSchema, {
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
      v.safeParse(createAnnouncementInputSchema, { title: "", body: "" })
        .success
    ).toBe(false)
  })

  it("accepts a member-targeted chat room", () => {
    expect(
      v.parse(createChatRoomInputSchema, {
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
      v.safeParse(sendChatMessageInputSchema, { content: "了解" }).success
    ).toBe(false)
  })

  it("validates a web push subscription", () => {
    expect(
      v.safeParse(pushSubscriptionInputSchema, {
        endpoint: "https://push.example.test/subscription/1",
        expirationTime: null,
        keys: { p256dh: "public-key", auth: "auth-secret" },
      }).success
    ).toBe(true)
  })
})
