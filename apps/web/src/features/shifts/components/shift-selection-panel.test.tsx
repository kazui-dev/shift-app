// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { makeEditors } from "../../../../dev/fixtures"
import { expect, it, vi } from "vite-plus/test"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"

vi.mock("./shift-popover", () => ({
  ShiftPopover: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}))

it("initializes both time inputs with HH:mm so either endpoint can be edited alone", () => {
  const startsAt = "2026-10-29T00:03:00.000Z"
  const endsAt = "2026-10-29T01:17:00.000Z"
  const slots = [
    { id: "slot", capacity: null, startsAt, endsAt, memberIds: ["member"] },
  ]
  const html = renderToStaticMarkup(
    <ShiftSelectionPanel
      anchor={{ position: null, focus: () => null }}
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

it.each([false, true])(
  "only requires changes for existing assignments (editing: %s)",
  async (editing) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    const data = makeEditors()[0]
    const slot = data?.slots[0]
    const memberId = slot?.memberIds[0]
    if (!data || !slot || !memberId) throw new Error("fixture")
    const selection = {
      memberId,
      slotId: editing ? slot.id : null,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    }
    const apply = vi.fn<Parameters<typeof ShiftSelectionPanel>[0]["onApply"]>(
      () => null
    )
    const close = vi.fn<() => void>()
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () =>
        root.render(
          <ShiftSelectionPanel
            anchor={{ position: null, focus: () => null }}
            selection={selection}
            slots={[
              slot,
              {
                ...slot,
                id: "another-slot",
                startsAt: "2026-11-01T05:00:00.000Z",
                endsAt: "2026-11-01T06:00:00.000Z",
              },
            ]}
            startsAt={slot.startsAt}
            endsAt={slot.endsAt}
            data={data}
            pending={false}
            onApply={apply}
            onClose={close}
            onRemove={() => {}}
          />
        )
      )
      const action = (label: string) => {
        const button = [...host.querySelectorAll("button")].find(
          (item) => item.textContent === label
        )
        if (!button) throw new Error(`Missing ${label}`)
        return button
      }
      expect(host.querySelectorAll("form")).toHaveLength(1)
      expect(host.querySelector("form")?.getAttribute("data-slot-editor")).toBe(
        editing ? slot.id : null
      )
      expect(action("反映").disabled).toBe(editing)
      expect(action("キャンセル").disabled).toBe(editing)
      await act(async () => action("反映").click())
      expect(apply.mock.calls).toEqual(
        editing ? [] : [[selection, data.activity.id]]
      )
      await act(async () => action("キャンセル").click())
      expect(close).toHaveBeenCalledTimes(editing ? 0 : 1)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      vi.unstubAllGlobals()
    }
  }
)
