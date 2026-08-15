import { describe, expect, it } from "vitest"

import { dueReminderWindow } from "./push"

describe("push reminders", () => {
  it("selects assignments in the minute ending ten minutes ahead", () => {
    expect(dueReminderWindow(1_000)).toEqual({
      from: 541_000,
      to: 601_000,
    })
  })
})
