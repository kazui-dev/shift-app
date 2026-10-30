import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vite-plus/test"
import { ShiftCoworkers } from "./shift-coworkers"
import type { ShiftCoworker } from "@workspace/shared/shifts"

const at = (hour: number) =>
  `2026-11-01T${String(hour).padStart(2, "0")}:00:00+09:00`
const assignment = {
  id: "own",
  activityId: "reception",
  memberId: "self",
  memberDisplayName: "自分",
  roomId: null,
  activityName: "受付",
  activityType: "シフト",
  place: "入口",
  color: "#64748b",
  notes: null,
  startsAt: at(9),
  endsAt: at(13),
}
function member(
  id: string,
  start: number,
  end: number,
  overrides: Partial<ShiftCoworker> = {}
): ShiftCoworker {
  return {
    id,
    memberId: id,
    name: id,
    studentId: `26EC${id}`,
    activityId: "reception",
    startsAt: at(start),
    endsAt: at(end),
    attendance: null,
    ...overrides,
  }
}

it("shows only overlapping coworkers, groups by current time, and keeps complete and separate time slots", () => {
  const html = renderToStaticMarkup(
    <ShiftCoworkers
      assignment={assignment}
      now={Date.parse(at(10))}
      members={[
        member("ended", 8, 10),
        member("future", 12, 15),
        member("current", 10, 12, {
          attendance: {
            state: "absent",
            expectedAt: null,
            checkInStatus: null,
          },
        }),
        member("second", 12, 13, { memberId: "current", name: "current" }),
        member("boundary-before", 8, 9),
        member("boundary-after", 13, 15),
        member("different-shift", 9, 12, { activityId: "other" }),
        member("own-row", 9, 13, { memberId: "self" }),
      ]}
    />
  )
  for (const hidden of [
    "boundary-before",
    "boundary-after",
    "different-shift",
    "own-row",
  ])
    expect(html).not.toContain(hidden)
  expect(html.indexOf("現在の勤務予定")).toBeLessThan(
    html.indexOf("勤務開始前")
  )
  expect(html.indexOf("勤務開始前")).toBeLessThan(html.indexOf("勤務時間終了"))
  expect(html).toContain("current：欠勤")
  expect(html).toContain("08:00")
  expect(html).toContain("15:00")
  expect(html.match(/current：/g)).toHaveLength(2)
  expect(html).not.toContain("さん")
})

it("shows an empty state when no one overlaps", () => {
  expect(
    renderToStaticMarkup(
      <ShiftCoworkers
        assignment={assignment}
        now={Date.parse(at(10))}
        members={[]}
      />
    )
  ).toContain("時間が重なるメンバーはいません。")
})
