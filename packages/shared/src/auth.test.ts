import { describe, expect, it } from "vitest"

import { onboardingInputSchema } from "./auth"

describe("onboardingInputSchema", () => {
  it("normalizes student IDs with NFKC and uppercase", () => {
    expect(
      onboardingInputSchema.parse({
        studentId: " ２６ａｊ１１２ ",
        displayName: "  旭祭 太郎  ",
      })
    ).toEqual({ studentId: "26AJ112", displayName: "旭祭 太郎" })
  })

  it.each(["26A112", "2026AJ112", "26AJ11A", "26AJ1122"])(
    "rejects an invalid student ID: %s",
    (studentId) => {
      expect(() =>
        onboardingInputSchema.parse({ studentId, displayName: "旭祭 太郎" })
      ).toThrow()
    }
  )
})
