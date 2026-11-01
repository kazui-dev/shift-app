import type { Attendance } from "@workspace/shared/shifts"

type DisplayAttendance = Pick<
  Attendance,
  "state" | "checkInStatus" | "resolvedAt"
>

export function attendanceLabel(
  attendance: DisplayAttendance | null | undefined
) {
  if (!attendance) return "出勤記録なし"
  if (attendance.state === "present")
    return attendance.checkInStatus === "pending" ? "出勤確認待ち" : "出勤済み"
  return `${attendance.state === "late" ? "遅刻" : "欠勤"}${attendance.resolvedAt ? "（対応済み）" : ""}`
}

export function assignmentBackground(
  color: string,
  attendance: DisplayAttendance | null | undefined,
  attendanceColors: boolean,
  selected: boolean
) {
  const tint = attendanceColors
    ? {
        late: "#D97706",
        absent: "#DC2626",
        present: "#16A34A",
        unrecorded: "#64748B",
      }[attendance?.state ?? "unrecorded"]
    : color
  return `color-mix(in oklab, ${tint} ${selected ? 60 : attendanceColors ? 30 : 22}%, var(--background))`
}
