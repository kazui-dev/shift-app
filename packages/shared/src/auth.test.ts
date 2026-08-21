import * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"

import {
  identityLinkDecisionInputSchema,
  onboardingInputSchema,
  updateAccessLevelInputSchema,
} from "./auth"

describe("onboardingInputSchema", () => {
  it("normalizes student IDs with NFKC and uppercase", () => {
    expect(
      v.parse(onboardingInputSchema, {
        studentId: " ２６ａｊ１１２ ",
        displayName: "  旭祭 太郎  ",
      })
    ).toEqual({ studentId: "26AJ112", displayName: "旭祭 太郎" })
  })

  it.each(["26A112", "2026AJ112", "26AJ11A", "26AJ1122"])(
    "rejects an invalid student ID: %s",
    (studentId) => {
      expect(() =>
        v.parse(onboardingInputSchema, { studentId, displayName: "旭祭 太郎" })
      ).toThrow()
    }
  )
})

describe("admin mutation schemas", () => {
  it("normalizes and requires an audit reason for role changes", () => {
    expect(
      v.parse(updateAccessLevelInputSchema, {
        accessLevel: "leader",
        reason: "　委員会幹部への就任　",
      })
    ).toEqual({ accessLevel: "leader", reason: "委員会幹部への就任" })

    expect(() =>
      v.parse(updateAccessLevelInputSchema, {
        accessLevel: "leader",
        reason: "   ",
      })
    ).toThrow()
  })

  it("only accepts explicit identity-link decisions", () => {
    expect(
      v.parse(identityLinkDecisionInputSchema, {
        decision: "approved",
        reason: "学生証を対面確認済み",
      })
    ).toEqual({ decision: "approved", reason: "学生証を対面確認済み" })

    expect(() =>
      v.parse(identityLinkDecisionInputSchema, {
        decision: "pending",
        reason: "未判断",
      })
    ).toThrow()
  })
})
