import * as v from "valibot"
import { expect, it } from "vite-plus/test"

import { liveEventSchema } from "./live"

const id = "10000000-0000-4000-8000-000000000001"

it("accepts chat and data events and rejects unknown or malformed ones", () => {
  for (const event of [
    { type: "room_changed", roomId: id },
    { type: "access_changed" },
    { type: "attendance_changed", activityId: id },
    { type: "availability_changed", year: 2026 },
    { type: "profile_changed", memberId: id, image: null },
  ])
    expect(v.safeParse(liveEventSchema, event).success).toBe(true)
  for (const event of [
    { type: "unknown" },
    { type: "attendance_changed", activityId: "shift" },
    { type: "profile_changed", memberId: id, image: "not a url" },
  ])
    expect(v.safeParse(liveEventSchema, event).success).toBe(false)
})
