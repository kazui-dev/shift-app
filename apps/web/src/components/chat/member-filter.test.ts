import { expect, it } from "vite-plus/test"
import { matchesMemberFilter } from "./member-filter"

it("matches any selected role and any selected shift, requiring both groups when supplied", () => {
  const member = {
    targetType: "member",
    targetId: "m",
    displayName: "名前",
    image: null,
    roleIds: ["r1"],
    activityIds: ["a1"],
  } as const
  const candidate = {
    ...member,
    roleIds: [...member.roleIds],
    activityIds: [...member.activityIds],
  }
  expect(matchesMemberFilter(candidate, [], [])).toBe(true)
  expect(matchesMemberFilter(candidate, ["r2", "r1"], [])).toBe(true)
  expect(matchesMemberFilter(candidate, [], ["a2", "a1"])).toBe(true)
  expect(matchesMemberFilter(candidate, ["r1"], ["a1"])).toBe(true)
  expect(matchesMemberFilter(candidate, ["r2"], ["a1"])).toBe(false)
  expect(matchesMemberFilter(candidate, ["r1"], ["a2"])).toBe(false)
})
