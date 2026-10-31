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
    selecting = false
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

it("colors the entire member row without adding attendance text or changing the work bars", () => {
  const { records, render } = fixture()
  for (const [state, color] of [
    ["late", "bg-amber-50"],
    ["absent", "bg-red-50"],
  ] as const) {
    const record = records[0]
    if (!record?.attendance) throw new Error("Missing attendance")
    const host = render(undefined, [
      { ...record, attendance: { ...record.attendance, state } },
    ])
    const row = host
      .querySelector("[data-shift-member]")
      ?.closest(".shift-name")?.parentElement
    expect(row?.className).toContain(color)
    expect(row?.className).toContain("h-14")
    expect(row?.textContent).not.toMatch(/遅刻|欠勤|対応済み/)
    expect(
      host
        .querySelector('[data-slot-id="morning"] [data-shift-bar]')
        ?.getAttribute("style")
    ).toContain("color-mix")
    expect(
      host.querySelector("[data-shift-member]")?.getAttribute("aria-label")
    ).toContain(state === "late" ? "遅刻" : "欠勤")
    const selected = render(
      undefined,
      [{ ...record, attendance: { ...record.attendance, state } }],
      true
    )
    expect(selected.querySelector("[aria-pressed=true]")).not.toBeNull()
  }
})

it("always uses the latest status for this shift and clears the row color after check-in or withdrawal", () => {
  const { data, records, render } = fixture()
  const updated = records.map((record, i) => ({
    ...record,
    attendance: record.attendance
      ? { ...record.attendance, updatedAt: at(`08:0${i}`) }
      : null,
  }))
  function rowClass(
    attendance: AttendanceData["assignments"],
    plan = planOf(data)
  ) {
    return render(plan, attendance)
      .querySelector("[data-shift-member]")
      ?.closest(".shift-name")?.parentElement?.className
  }
  expect(rowClass(updated.slice(0, 1))).toContain("bg-amber-50")
  expect(rowClass(updated.slice(0, 2).reverse())).toContain("bg-red-50")
  expect(rowClass(updated.slice().reverse())).not.toMatch(/bg-amber|bg-red/)
  expect(
    rowClass(updated.map((record) => ({ ...record, attendance: null })))
  ).not.toMatch(/bg-amber|bg-red/)
  expect(
    rowClass(updated.map((record) => ({ ...record, active: false })))
  ).not.toMatch(/bg-amber|bg-red/)
  expect(
    rowClass(updated.map((record) => ({ ...record, memberId: "other" })))
  ).not.toMatch(/bg-amber|bg-red/)
  const original = planOf(data)
  const changed: ActivityEditorInput = {
    ...original,
    slots: original.slots.map((slot) => ({ ...slot, id: `new-${slot.id}` })),
  }
  expect(rowClass(updated, changed)).not.toMatch(/bg-amber|bg-red/)
})
