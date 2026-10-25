import * as v from "valibot"
import { expect, it } from "vite-plus/test"
import { shiftNoticesSchema } from "./notices"

const notice = {
  id: "10000000-0000-4000-8000-000000000001",
  startsAt: "2026-11-01T00:00:00.000Z",
  endsAt: "2026-11-01T03:00:00.000Z",
  content: " 雨に注意 ",
}
it("validates periods, unique IDs, and nonempty bounded content", () => {
  expect(v.parse(shiftNoticesSchema, [notice])[0]?.content).toBe("雨に注意")
  expect(v.safeParse(shiftNoticesSchema, []).success).toBe(true)
  for (const value of [
    [notice, notice],
    [{ ...notice, content: " " }],
    [{ ...notice, endsAt: notice.startsAt }],
    [{ ...notice, content: "a".repeat(2001) }],
  ]) {
    expect(v.safeParse(shiftNoticesSchema, value).success).toBe(false)
  }
})
