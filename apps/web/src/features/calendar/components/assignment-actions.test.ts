import { expect, it } from "vite-plus/test"
import {
  attendanceLabel,
  attendanceOpen,
} from "@/features/calendar/components/assignment-actions"

const shift = {
  startsAt: "2026-09-15T01:00:00.000Z",
  endsAt: "2026-09-15T02:00:00.000Z",
  attendance: null,
}
const at = (iso: string) => Date.parse(iso)
const attendance = (state: "late" | "absent" | "present") => ({
  state,
  expectedAt: null,
  reason: "",
  checkedInAt: null,
  checkInStatus: null,
  resolvedAt: null,
  updatedAt: "2026-09-15T00:00:00.000Z",
})

it("takes attendance until a shift ends, and never after checking in", () => {
  expect(attendanceOpen(shift, at("2026-09-14T00:00:00.000Z"))).toBe(true)
  expect(attendanceOpen(shift, at("2026-09-15T02:00:00.000Z"))).toBe(false)
  expect(
    attendanceOpen(
      { ...shift, attendance: attendance("present") },
      at("2026-09-15T01:10:00.000Z")
    )
  ).toBe(false)
})

it("labels the button by what has been set", () => {
  expect(attendanceLabel({ attendance: null })).toBe("勤怠")
  expect(attendanceLabel({ attendance: attendance("present") })).toBe("出勤済")
  expect(attendanceLabel({ attendance: attendance("late") })).toBe("遅刻")
  expect(attendanceLabel({ attendance: attendance("absent") })).toBe("欠勤")
})
