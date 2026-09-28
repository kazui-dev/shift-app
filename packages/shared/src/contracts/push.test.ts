import * as v from "valibot"
import { expect, it } from "vite-plus/test"

import { pushSubscriptionInputSchema } from "./push"

it("validates a web push subscription", () => {
  expect(
    v.safeParse(pushSubscriptionInputSchema, {
      endpoint: "https://push.example.test/subscription/1",
      expirationTime: null,
      keys: { p256dh: "public-key", auth: "auth-secret" },
    }).success
  ).toBe(true)
})
