import { expect, it } from "vite-plus/test"

import { attendanceNotice } from "../../src/features/attendance/domain/attendance-notice"

const shift = {
  displayName: "美輪和維",
  startsAt: Date.parse("2026-09-18T06:38:00Z"),
  endsAt: Date.parse("2026-09-18T08:38:00Z"),
}

it("puts heading and name, the shift, then one item a line, and says it on one line for the push", () => {
  expect(
    attendanceNotice({
      ...shift,
      state: "late",
      expectedAt: Date.parse("2026-09-18T07:10:00Z"),
      reason: "電車の遅延",
    })
  ).toEqual({
    content:
      "【遅刻】 美輪和維\nシフト: 9/18 15:38〜17:38\n到着見込み: 16:10\n理由: 電車の遅延",
    notification:
      "【遅刻】 美輪和維 (9/18 15:38〜17:38) 到着見込み: 16:10 理由: 電車の遅延",
  })
})

it("says an unknown arrival is undecided and leaves out an empty reason", () => {
  expect(
    attendanceNotice({ ...shift, state: "late", expectedAt: null, reason: "" })
      .content
  ).toBe("【遅刻】 美輪和維\nシフト: 9/18 15:38〜17:38\n到着見込み: 未定")
  expect(
    attendanceNotice({ ...shift, state: "absent", reason: "" }).notification
  ).toBe("【欠勤】 美輪和維 (9/18 15:38〜17:38)")
})

it("names the reason for an absence and what a withdrawal took back", () => {
  expect(
    attendanceNotice({ ...shift, state: "absent", reason: "体調不良" })
  ).toEqual({
    content: "【欠勤】 美輪和維\nシフト: 9/18 15:38〜17:38\n理由: 体調不良",
    notification: "【欠勤】 美輪和維 (9/18 15:38〜17:38) 理由: 体調不良",
  })
  expect(
    attendanceNotice({ ...shift, state: "withdrawn", previous: "late" })
  ).toEqual({
    content:
      "【取り消し】 美輪和維\nシフト: 9/18 15:38〜17:38\n取り消した連絡: 遅刻",
    notification:
      "【取り消し】 美輪和維 (9/18 15:38〜17:38) 取り消した連絡: 遅刻",
  })
})
