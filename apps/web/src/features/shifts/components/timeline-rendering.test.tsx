// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { emptyFilter } from "@workspace/ui/lib/filters"
import type { ShiftOverview } from "@workspace/shared/shifts"
import { makeEditors } from "../../../../dev/fixtures"
import { OverviewGrid } from "./overview-grid"
import { TimeGrid } from "./time-grid"
import { ShiftMemberLabel } from "./shift-member-label"
import type { ShiftSelection } from "./shift-selection-panel"
import { useAssignmentSelection } from "./use-assignment-selection"
import { planOf } from "./use-shift-plan"

vi.mock("./shift-member-label", () => ({
  ShiftMemberLabel: vi.fn<(props: { name: string }) => ReactNode>(
    ({ name }) => <span>{name}</span>
  ),
}))

it("only redraws changed member highlights when opening, switching and closing an editor", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const source = makeEditors()[0]
  if (!source) throw new Error("Missing fixture")
  const data = { ...source, members: source.members.slice(0, 3) }
  const plan = planOf(data)
  const filter = emptyFilter()
  const available: string[] = []
  const onSelect = vi.fn<() => void>(),
    onCommit = vi.fn<() => void>(),
    onMember = vi.fn<() => void>()
  function Demo({ selection }: { selection: ShiftSelection | null }) {
    const removal = useAssignmentSelection("shift", available)
    return (
      <TimeGrid
        data={data}
        plan={plan}
        search=""
        roles={filter}
        availability={filter}
        selection={selection}
        assignmentSelection={removal}
        onSelect={onSelect}
        onCommit={onCommit}
        onMember={onMember}
      />
    )
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const label = vi.mocked(ShiftMemberLabel)
  label.mockClear()
  const select = (index: number): ShiftSelection => {
    const member = data.members[index]
    if (!member) throw new Error("Missing member")
    return {
      memberId: member.id,
      slotId: null,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
    }
  }
  try {
    await act(async () => root.render(<Demo selection={null} />))
    expect(label).toHaveBeenCalledTimes(3)
    await act(async () => root.render(<Demo selection={select(0)} />))
    expect(label).toHaveBeenCalledTimes(4)
    await act(async () => root.render(<Demo selection={select(1)} />))
    expect(label).toHaveBeenCalledTimes(6)
    await act(async () => root.render(<Demo selection={null} />))
    expect(label).toHaveBeenCalledTimes(7)
    // Other menu state in the parent must not redraw the grid either.
    await act(async () => root.render(<Demo selection={null} />))
    expect(label).toHaveBeenCalledTimes(7)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})

it("does not redraw overview rows when only the editor changes, but reflects changed data", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const source = makeEditors()[0]
  if (!source) throw new Error("Missing fixture")
  const data: ShiftOverview = {
    canEdit: true,
    members: source.members.slice(0, 3),
    roles: source.roles,
    activities: [],
    assignments: [],
    availability: [],
    availabilityAnswers: [],
  }
  const rows = data.members.map((member) => ({ member, assignments: [] }))
  const onSelect = vi.fn<() => void>(),
    onInspect = vi.fn<() => void>()
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const label = vi.mocked(ShiftMemberLabel)
  label.mockClear()
  const render = (open: boolean, currentRows = rows) =>
    root.render(
      <>
        <OverviewGrid
          data={data}
          rows={currentRows}
          date="2026-11-01"
          now={0}
          onSelect={onSelect}
          onInspect={onInspect}
        />
        {open && <dialog open>編集</dialog>}
      </>
    )
  try {
    await act(async () => render(false))
    expect(label).toHaveBeenCalledTimes(3)
    await act(async () => render(true))
    await act(async () => render(false))
    expect(label).toHaveBeenCalledTimes(3)
    await act(async () =>
      render(
        false,
        rows.map((row) => ({
          ...row,
          member: { ...row.member, displayName: "更新された名前" },
        }))
      )
    )
    expect(host.textContent).toContain("更新された名前")
    expect(label).toHaveBeenCalledTimes(6)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
