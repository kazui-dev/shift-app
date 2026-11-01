// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vite-plus/test"
import { emptyFilter } from "@workspace/ui/lib/filters"
import { makeEditors } from "../../../../dev/fixtures"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import type { AttendanceData } from "./attendance-data"
import { planOf } from "./use-shift-plan"
import { TimeGrid } from "./time-grid"
import { assignmentKey } from "./assignment-removal"

const at = (time: string) => `2026-10-30T${time}:00+09:00`
const member = {
  id: "member",
  displayName: "佐藤 葵",
  studentId: "26AJ001",
  image: null,
  roles: [],
}
function fixture() {
  const source = makeEditors()[0]
  if (!source) throw new Error("Missing fixture")
  const slots = [
    { id: "morning", startsAt: at("09:00"), endsAt: at("10:00") },
    { id: "short", startsAt: at("10:00"), endsAt: at("10:01") },
    { id: "afternoon", startsAt: at("13:00"), endsAt: at("14:00") },
    { id: "unrecorded", startsAt: at("15:00"), endsAt: at("16:00") },
  ].map((slot) => ({ ...slot, capacity: null, memberIds: [member.id] }))
  const data = {
    ...source,
    activity: {
      ...source.activity,
      startsAt: at("09:00"),
      endsAt: at("17:00"),
    },
    slots,
    members: [member],
    otherAssignments: [],
  }
  const records: AttendanceData["assignments"] = slots
    .slice(0, 3)
    .map((slot, i) => ({
      id: slot.id,
      memberId: member.id,
      memberDisplayName: member.displayName,
      memberStudentId: member.studentId,
      memberDuties: [],
      own: false,
      active: true,
      startsAt: new Date(slot.startsAt).toISOString(),
      endsAt: new Date(slot.endsAt).toISOString(),
      attendance: {
        state: i === 0 ? "late" : i === 1 ? "absent" : "present",
        expectedAt: null,
        reason: "確認用",
        checkedInAt: null,
        checkInStatus: "confirmed",
        resolvedAt: i === 1 ? at("11:00") : null,
        updatedAt: at("08:00"),
      },
    }))
  function render(
    plan = planOf(data),
    attendance = records,
    selecting = false,
    attendanceColors = true
  ) {
    const key = assignmentKey({
      activityId: data.activity.id,
      slotId: "morning",
      memberId: member.id,
    })
    const host = document.createElement("div")
    host.innerHTML = renderToStaticMarkup(
      <TimeGrid
        data={data}
        attendance={attendance}
        attendanceColors={attendanceColors}
        plan={plan}
        search=""
        roles={emptyFilter()}
        availability={emptyFilter()}
        selection={null}
        onSelect={() => {}}
        onCommit={() => {}}
        onMember={() => {}}
        assignmentSelection={
          selecting
            ? {
                active: true,
                available: [key],
                keys: [key],
                toggle: () => {},
                replace: () => {},
              }
            : undefined
        }
      />
    )
    return host
  }
  return { data, records, render }
}

function barStyles(host: HTMLElement) {
  return [...host.querySelectorAll("[data-shift-bar]")].map((bar) =>
    bar.getAttribute("style")
  )
}

it("colors each duty independently without tinting the row or adding visible status text", () => {
  const { render } = fixture()
  const host = render()
  const row = host.querySelector(".shift-timeline-row")
  expect(row?.className).not.toMatch(/bg-amber|bg-red/)
  expect(row?.textContent).not.toMatch(/遅刻|欠勤|出勤済み|出勤記録なし/)
  expect(barStyles(host)).toEqual([
    expect.stringContaining("#D97706 30%"),
    expect.stringContaining("#DC2626 30%"),
    expect.stringContaining("#16A34A 30%"),
    expect.stringContaining("#64748B 30%"),
  ])
  expect(
    host.querySelector('[data-slot-id="morning"]')?.getAttribute("title")
  ).toContain("遅刻")
  expect(
    host
      .querySelector('[data-slot-id="short"] [data-shift-bar]')
      ?.getAttribute("title")
  ).toContain("欠勤（対応済み）")
  expect(
    host
      .querySelector('[data-slot-id="unrecorded"] [data-shift-bar]')
      ?.getAttribute("title")
  ).toContain("出勤記録なし")
  const selected = render(undefined, undefined, true)
  expect(
    selected.querySelector('[aria-pressed="true"]')?.getAttribute("aria-label")
  ).toContain("遅刻")
  expect(barStyles(selected)[0]).toContain("#D97706 60%")
  expect(
    barStyles(render(undefined, undefined, false, false)).every((style) =>
      style?.includes("22%")
    )
  ).toBe(true)
})

it("uses only the matching saved duty and member; updates and withdrawals affect just that bar", () => {
  const { data, records, render } = fixture()
  const first = records[0]
  if (!first?.attendance) throw new Error("Missing attendance")
  const updated = [
    {
      ...first,
      attendance: { ...first.attendance, state: "present" as const },
    },
    ...records.slice(1),
  ]
  expect(barStyles(render(undefined, updated))[0]).toContain("#16A34A")
  for (const invalid of [
    { ...first, attendance: null },
    { ...first, active: false },
    { ...first, memberId: "other" },
    { ...first, startsAt: at("08:59") },
    { ...first, endsAt: at("10:02") },
  ]) {
    const styles = barStyles(render(undefined, [invalid, ...records.slice(1)]))
    expect(styles[0]).toContain("#64748B")
    expect(styles[1]).toContain("#DC2626")
  }
  const original = planOf(data)
  const changed: ActivityEditorInput = {
    ...original,
    slots: original.slots.map((slot) => ({ ...slot, id: `new-${slot.id}` })),
  }
  expect(
    barStyles(render(changed)).every((style) => style?.includes("#64748B"))
  ).toBe(true)
  const moved = {
    ...original,
    slots: original.slots.map((slot) => ({ ...slot, startsAt: at("09:01") })),
  }
  expect(barStyles(render(moved))[0]).toContain("#D97706")
  expect(
    barStyles(render(undefined, [])).every((style) =>
      style?.includes("#64748B")
    )
  ).toBe(true)
})
