import * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"

import {
  chatTargetsResponseSchema,
  createChatRoomInputSchema,
  pushSubscriptionInputSchema,
  sendChatMessageInputSchema,
} from "./communications"

describe("communication schemas", () => {
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

  it("keeps chat target discovery limited to display identity", () => {
    const target = {
      targetType: "member",
      targetId: "6632fe2d-1064-442c-8884-3b674f564e60",
      displayName: "旭祭 太郎",
    } as const

    expect(v.parse(chatTargetsResponseSchema, { targets: [target] })).toEqual({
      targets: [target],
    })
    expect(
      v.safeParse(chatTargetsResponseSchema, {
        targets: [{ ...target, studentId: "26AJ112" }],
      }).success
    ).toBe(false)
  })

  it("accepts role and activity chat targets", () => {
    const targets = [
      {
        targetType: "role",
        targetId: "1ef914f9-54ef-4b21-b415-df06abf43d43",
        displayName: "本部",
      },
      {
        targetType: "activity",
        targetId: "89c8940f-a0d1-48bb-965e-2ac8718bca11",
        displayName: "正門警備",
      },
    ]

    expect(v.parse(chatTargetsResponseSchema, { targets })).toEqual({ targets })
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
