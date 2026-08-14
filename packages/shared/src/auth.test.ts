import { describe, expect, it } from "vitest"

import {
  identityLinkDecisionInputSchema,
  onboardingInputSchema,
  updateAccessLevelInputSchema,
} from "./auth"

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

describe("admin mutation schemas", () => {
  it("normalizes and requires an audit reason for role changes", () => {
    expect(
      updateAccessLevelInputSchema.parse({
        accessLevel: "leader",
        reason: "　委員会幹部への就任　",
      })
    ).toEqual({ accessLevel: "leader", reason: "委員会幹部への就任" })

    expect(() =>
      updateAccessLevelInputSchema.parse({
        accessLevel: "leader",
        reason: "   ",
      })
    ).toThrow()
  })

  it("only accepts explicit identity-link decisions", () => {
    expect(
      identityLinkDecisionInputSchema.parse({
        decision: "approved",
        reason: "学生証を対面確認済み",
      })
    ).toEqual({ decision: "approved", reason: "学生証を対面確認済み" })

    expect(() =>
      identityLinkDecisionInputSchema.parse({
        decision: "pending",
        reason: "未判断",
      })
    ).toThrow()
  })
})
