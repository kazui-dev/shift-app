import { expect, it } from "vite-plus/test"
import { attendanceLabel, assignmentBackground } from "./assignment-attendance"

it("uses the same recorded status and color in both grids, including pending and resolved records", () => {
  expect(attendanceLabel(null)).toBe("出勤記録なし")
  expect(attendanceLabel(undefined)).toBe("出勤記録なし")
  expect(assignmentBackground("#123456", undefined, true, false)).toContain(
    "#64748B 30%"
  )
  for (const [state, color, label] of [
    ["present", "#16A34A", "出勤済み"],
    ["late", "#D97706", "遅刻"],
    ["absent", "#DC2626", "欠勤"],
  ] as const) {
    const record = { state, checkInStatus: null, resolvedAt: null }
    expect(attendanceLabel(record)).toBe(label)
    expect(assignmentBackground("#123456", record, true, false)).toContain(
      `${color} 30%`
    )
    expect(assignmentBackground("#123456", record, true, true)).toContain(
      `${color} 60%`
    )
    expect(assignmentBackground("#123456", record, false, false)).toContain(
      "#123456 22%"
    )
    expect(assignmentBackground("#123456", record, false, true)).toContain(
      "#123456 60%"
    )
  }
  expect(
    attendanceLabel({
      state: "present",
      checkInStatus: "pending",
      resolvedAt: null,
    })
  ).toBe("出勤確認待ち")
  expect(
    attendanceLabel({
      state: "late",
      checkInStatus: null,
      resolvedAt: "2026-11-01T00:00:00Z",
    })
  ).toBe("遅刻（対応済み）")
  expect(
    attendanceLabel({
      state: "absent",
      checkInStatus: null,
      resolvedAt: "2026-11-01T00:00:00Z",
    })
  ).toBe("欠勤（対応済み）")
})
