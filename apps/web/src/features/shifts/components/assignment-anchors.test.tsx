// @vitest-environment jsdom
import { act, useEffect, type ComponentProps } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import { TimeGridRow } from "./time-grid-row"
import { timeScale } from "./time-scale"
import { useShiftPlan, planOf } from "./use-shift-plan"
import { transferAssignment } from "./transfer-assignment"
import type { ShiftAnchor } from "./shift-anchor"

function bounds(anchor: ShiftAnchor | undefined) {
  const position = anchor?.position
  if (
    !position ||
    typeof position === "function" ||
    !("getBoundingClientRect" in position)
  )
    throw new Error("Missing anchor")
  return position.getBoundingClientRect()
}

it("edits duties from their vertical padding, anchors to the visible bar and only resizes from handles", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const source = makeEditors()[1],
    member = source?.members[1],
    slot = source?.slots[1],
    foreign = source?.otherAssignments[0]
  if (!source || !member || !slot || !foreign) throw new Error("fixture")
  const select = vi.fn<ComponentProps<typeof TimeGridRow>["onSelect"]>(),
    commit = vi.fn<ComponentProps<typeof TimeGridRow>["onCommit"]>(),
    other = vi.fn<NonNullable<ComponentProps<typeof TimeGridRow>["onOther"]>>(),
    host = document.createElement("div"),
    root = createRoot(host)
  document.body.append(host)
  try {
    await act(async () =>
      root.render(
        <TimeGridRow
          activityId={source.activity.id}
          member={member}
          duties={[]}
          status="available"
          availability={[]}
          slots={[slot]}
          otherAssignments={[foreign]}
          attendance={new Map()}
          attendanceColors={false}
          color="#64748B"
          scale={timeScale(source.activity.startsAt, source.activity.endsAt)}
          selected={false}
          onSelect={select}
          onOther={other}
          onCommit={commit}
          onMember={() => {}}
        />
      )
    )
    const bar = host.querySelector<HTMLElement>("[data-slot-id]"),
      row = host.querySelector<HTMLButtonElement>(
        'button[aria-label$="の勤務時間を変更"]'
      )
    if (!bar || !row) throw new Error("Missing bar")
    const visibleBar = bar.querySelector<HTMLElement>("[data-shift-bar]")
    if (!visibleBar) throw new Error("Missing visible bar")
    const barBounds = vi
      .spyOn(visibleBar, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(100, 117, 200, 20))
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 100, 720, 56)
    )
    row.setPointerCapture = () => {}
    await act(async () => {
      bar.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 140,
          clientY: 105,
        })
      )
      row.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 160 })
      )
      row.dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, clientX: 160 })
      )
      row.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          detail: 1,
          clientX: 140,
          clientY: 105,
        })
      )
    })
    expect(bounds(select.mock.lastCall?.[1])).toMatchObject({
      left: 140,
      top: 117,
      bottom: 137,
      width: 0,
    })
    expect(select.mock.lastCall?.[1].focus).toBe(row)
    expect(select.mock.lastCall?.[0].slotId).toBe(slot.id)
    expect(commit).not.toHaveBeenCalled()
    barBounds.mockReturnValue(new DOMRect(200, 217, 400, 20))
    expect(bounds(select.mock.lastCall?.[1])).toMatchObject({
      left: 280,
      top: 217,
      bottom: 237,
    })
    await act(async () =>
      row.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          detail: 1,
          clientX: 460,
          clientY: 150,
        })
      )
    )
    expect(bounds(select.mock.lastCall?.[1])).toMatchObject({
      left: 460,
      top: 117,
      bottom: 137,
      width: 0,
    })
    const target = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === foreign.name
    )
    if (!target) throw new Error("Missing foreign button")
    const foreignBar = target.querySelector<HTMLElement>("[data-shift-bar]")
    if (!foreignBar) throw new Error("Missing foreign bar")
    vi.spyOn(foreignBar, "getBoundingClientRect").mockReturnValue(
      new DOMRect(300, 117, 200, 20)
    )
    await act(async () =>
      target.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          detail: 1,
          clientX: 470,
          clientY: 150,
        })
      )
    )
    expect(bounds(other.mock.lastCall?.[1])).toMatchObject({
      left: 470,
      top: 117,
      bottom: 137,
      width: 0,
    })
    await act(async () => target.click())
    expect(other).toHaveBeenCalledWith(foreign, {
      position: foreignBar,
      focus: target,
    })
    expect(select).toHaveBeenCalledTimes(2)
    const handle = bar.querySelector('[data-resize="end"]')
    if (!handle) throw new Error("Missing resize handle")
    await act(async () => {
      handle.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 300,
        })
      )
      row.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 340 })
      )
      row.dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, clientX: 340 })
      )
    })
    expect(commit).toHaveBeenCalledOnce()
    expect(commit.mock.lastCall?.[0].slotId).toBe(slot.id)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})

it("undoes and redoes both sides of a transfer together", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.spyOn(Date, "now").mockReturnValue(0)
  const [source, target] = makeEditors(),
    slot = source?.slots[0],
    memberId = slot?.memberIds[0]
  if (!source || !target || !slot || !memberId) throw new Error("fixture")
  const result = transferAssignment(
    source,
    target,
    {},
    { ...slot, slotId: slot.id, memberId }
  )
  if ("error" in result) throw new Error(result.error)
  const host = document.createElement("div"),
    root = createRoot(host)
  let current: ReturnType<typeof useShiftPlan> | undefined
  const data = source
  function Screen() {
    const editor = useShiftPlan(data, false)
    useEffect(() => {
      current = editor
    }, [editor])
    return null
  }
  try {
    await act(async () => root.render(<Screen />))
    await act(async () => current?.updateMany(result.updates))
    expect(current?.plan.slots[0]?.memberIds).not.toContain(memberId)
    expect(current?.related[target.activity.id]).toBeDefined()
    await act(async () => current?.undo())
    expect(current?.plan).toEqual(planOf(source))
    expect(current?.related).toEqual({})
    expect(current?.dirty).toBe(false)
    await act(async () => current?.redo())
    expect(current?.plan.slots[0]?.memberIds).not.toContain(memberId)
    expect(current?.related[target.activity.id]).toBeDefined()
  } finally {
    await act(async () => root.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})
