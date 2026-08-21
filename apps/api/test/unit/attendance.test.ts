import { describe, expect, it } from "vite-plus/test"

import { isCheckInTime } from "../../src/domain/attendance"

describe("attendance", () => {
  it("allows check-in at both assignment boundaries", () => {
    expect(isCheckInTime(100, 100, 200)).toBe(true)
    expect(isCheckInTime(200, 100, 200)).toBe(true)
  })

  it("rejects check-in outside the assignment", () => {
    expect(isCheckInTime(99, 100, 200)).toBe(false)
    expect(isCheckInTime(201, 100, 200)).toBe(false)
  })
})
