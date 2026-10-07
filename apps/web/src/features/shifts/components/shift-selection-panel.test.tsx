import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"

it("initializes both time inputs with HH:mm so either endpoint can be edited alone", () => {
  const startsAt = "2026-10-29T00:03:00.000Z"
  const endsAt = "2026-10-29T01:17:00.000Z"
  const slots = [
    { id: "slot", capacity: null, startsAt, endsAt, memberIds: ["member"] },
  ]
  const html = renderToStaticMarkup(
    <ShiftSelectionPanel
      selection={{ memberId: "member", slotId: "slot", startsAt, endsAt }}
      slots={slots}
      startsAt={startsAt}
      endsAt={endsAt}
      data={{
        activity: {
          id: "activity",
          year: 2026,
          name: "受付",
          place: "",
          activityType: "受付",
          startsAt,
          endsAt,
          color: "#123456",
          notes: null,
          active: true,
          version: 1,
        },
        candidateRoleIds: [],
        responsibles: [],
        slots,
        requirements: [],
        members: [],
        roles: [],
        availability: [],
        submittedMemberIds: [],
        availabilityAnswers: [],
        otherAssignments: [],
      }}
      pending={false}
      onClose={vi.fn<() => void>()}
      onRemove={vi.fn<(id: string) => void>()}
      onApply={vi.fn<(selection: ShiftSelection) => string | null>()}
    />
  )
  const inputs = html.match(/<input\b[^>]*>/g) ?? []
  expect(inputs).toHaveLength(2)
  expect(inputs[0]).toContain('type="time"')
  expect(inputs[0]).toContain('value="09:03"')
  expect(inputs[1]).toContain('type="time"')
  expect(inputs[1]).toContain('value="10:17"')
})
