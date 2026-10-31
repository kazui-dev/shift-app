// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vite-plus/test"
import type { ShiftOverview } from "@workspace/shared/shifts"
import { OverviewGrid } from "./overview-grid"

it("renders every filtered member in the page flow and adds writing fields only for print", () => {
  const members = Array.from({ length: 35 }, (_, i) => ({
    id: `member-${i}`,
    displayName: `Staff ${i}`,
    studentId: `26AJ${i}`,
    roles: [
      { id: "duty", name: "web班", color: "#000000" },
      { id: "bureau", name: "広報局", color: "#000000" },
    ],
    image: null,
  }))
  const data: ShiftOverview = {
    canEdit: false,
    members,
    roles: [
      { id: "duty", name: "web班", color: "#000000", duty: true },
      { id: "bureau", name: "広報局", color: "#000000", duty: false },
    ],
    availability: [],
    availabilityAnswers: [],
    activities: [],
    assignments: [],
  }
  const rows = members.map((member) => ({ member, assignments: [] }))
  const render = (printing: boolean) =>
    renderToStaticMarkup(
      <OverviewGrid
        printing={printing}
        data={data}
        rows={rows}
        date="2026-10-29"
        now={0}
        onSelect={() => {}}
        onInspect={() => {}}
      />
    )
  expect(render(false)).toContain("web班")
  expect(render(false)).not.toContain("広報局")
  expect(render(false)).toContain("Staff 34")
  expect(render(false)).not.toContain("の手書き欄")
  const printed = render(true)
  expect(printed).toContain("Staff 34")
  expect(printed).toContain("26AJ34")
  expect(render(false)).toContain("26AJ34")
  expect(printed.match(/の手書き欄/g)).toHaveLength(35)
  expect(printed).toContain("記録・修正")
})

it("counts recorded late assignments, including resolved records, without inferring lateness", () => {
  const member = {
    id: "one",
    displayName: "One",
    studentId: "26AJ001",
    roles: [],
    image: null,
  }
  const assignment = {
    id: "a",
    slotId: "s",
    activityId: "work",
    memberId: "one",
    startsAt: "2026-10-29T00:00:00Z",
    endsAt: "2026-10-29T01:00:00Z",
    attendance: null,
  }
  const assignments: ShiftOverview["assignments"] = [
    assignment,
    {
      ...assignment,
      id: "late",
      attendance: {
        state: "late",
        checkInStatus: null,
        checkedInAt: null,
        expectedAt: null,
        resolvedAt: "2026-10-29T00:30:00Z",
      },
    },
  ]
  const data: ShiftOverview = {
    canEdit: false,
    members: [member],
    roles: [],
    availability: [],
    availabilityAnswers: [],
    activities: [],
    assignments,
  }
  const rendered = renderToStaticMarkup(
    <OverviewGrid
      data={data}
      rows={[{ member, assignments }]}
      date="2026-10-29"
      now={0}
      onSelect={() => {}}
      onInspect={() => {}}
    />
  )
  expect(rendered).toContain("遅刻 1件")
})

it("switches every bar from activity colors to attendance colors without adding visible status text", () => {
  const member = {
    id: "one",
    displayName: "One",
    studentId: "26AJ001",
    roles: [],
    image: null,
  }
  const assignments: ShiftOverview["assignments"] = [
    "late",
    "absent",
    "present",
    "pending",
    "unrecorded",
  ].map((state) => ({
    id: state,
    slotId: state,
    activityId: "work",
    memberId: member.id,
    startsAt: "2026-10-29T00:00:00Z",
    endsAt: "2026-10-29T01:00:00Z",
    attendance:
      state === "unrecorded"
        ? null
        : {
            state: state === "late" || state === "absent" ? state : "present",
            checkInStatus: state === "pending" ? "pending" : "confirmed",
            checkedInAt: null,
            expectedAt: null,
            resolvedAt: "2026-10-29T00:30:00Z",
          },
  }))
  const data: ShiftOverview = {
    canEdit: false,
    members: [member],
    roles: [],
    availability: [],
    availabilityAnswers: [],
    activities: [
      {
        id: "work",
        name: "受付",
        color: "#7C3AED",
        active: true,
        startsAt: "2026-10-29T00:00:00Z",
        endsAt: "2026-10-29T01:00:00Z",
      },
    ],
    assignments,
  }
  const render = (attendanceColors: boolean, printing = false) => {
    const host = document.createElement("div")
    host.innerHTML = renderToStaticMarkup(
      <OverviewGrid
        attendanceColors={attendanceColors}
        printing={printing}
        data={data}
        rows={[{ member, assignments }]}
        date="2026-10-29"
        now={0}
        onSelect={() => {}}
        onInspect={() => {}}
      />
    )
    return [
      ...host.querySelectorAll<HTMLButtonElement>("[data-assignment-key]"),
    ]
  }
  const normal = render(false)
  const attendance = render(true)
  expect(attendance).toHaveLength(5)
  for (const bar of normal)
    expect(bar.getAttribute("style")).toContain("#7C3AED 22%")
  const colors = ["#D97706", "#DC2626", "#16A34A", "#16A34A", "#64748B"]
  attendance.forEach((bar, index) => {
    expect(bar.getAttribute("style")).toContain(`${colors[index]} 30%`)
    expect(bar.textContent).toBe(normal[index]?.textContent)
    expect(bar.textContent).not.toMatch(/遅刻|欠勤|出勤|対応済み/)
  })
  expect(attendance[0]?.title).toContain("遅刻（対応済み）")
  expect(attendance[3]?.getAttribute("aria-label")).toContain("出勤確認待ち")
  expect(attendance[4]?.title).toContain("出勤記録なし")
  expect(render(true, true).map((bar) => bar.getAttribute("style"))).toEqual(
    attendance.map((bar) => bar.getAttribute("style"))
  )
})
