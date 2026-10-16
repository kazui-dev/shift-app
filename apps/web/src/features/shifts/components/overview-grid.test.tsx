import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vite-plus/test"
import type { ShiftOverview } from "@workspace/shared/shifts"
import { OverviewGrid } from "./overview-grid"

it("renders every filtered member in the page flow and adds writing fields only for print", () => {
  const members = Array.from({ length: 35 }, (_, i) => ({
    id: `member-${i}`,
    displayName: `Staff ${i}`,
    studentId: `26AJ${i}`,
    roles: [],
    image: null,
  }))
  const data: ShiftOverview = {
    canEdit: false,
    members,
    roles: [],
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
  expect(render(false)).toContain("Staff 34")
  expect(render(false)).not.toContain("の手書き欄")
  const printed = render(true)
  expect(printed).toContain("Staff 34")
  expect(printed).toContain("26AJ34")
  expect(render(false)).not.toContain("26AJ34")
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
