import { expect, it } from "vite-plus/test"
import { copiesType, copyWorthSending } from "@/features/chat/lib/copy-plan"

it("copies still images but never animated ones", () => {
  expect(copiesType("image/jpeg")).toBe(true)
  expect(copiesType("image/png")).toBe(true)
  expect(copiesType("image/gif")).toBe(false)
})

it("sends a copy ahead only when it saves at least 30% of the bytes", () => {
  expect(copyWorthSending(700, 1000)).toBe(true)
  expect(copyWorthSending(701, 1000)).toBe(false)
})
