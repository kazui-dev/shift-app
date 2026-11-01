// @vitest-environment jsdom
import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { emptyFilter } from "@workspace/ui/lib/filters"
import { makeEditors } from "../../../../dev/fixtures"
import { TimeGrid } from "./time-grid"
import {
  ShiftSelectionPanel,
  type ShiftSelection,
} from "./shift-selection-panel"
import { planOf } from "./use-shift-plan"
import type { ShiftAnchor } from "./shift-anchor"

it("anchors additions at the clicked minute, switches members without blocking, and restores keyboard focus", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const source = makeEditors()[0]
  if (!source) throw new Error("Missing fixture")
  const data = { ...source, members: source.members.slice(0, 2), slots: [] }
  const plan = planOf(data)
  const outside = vi.fn<() => void>()
  function Screen() {
    const [selection, setSelection] = useState<
      (ShiftSelection & { anchor: ShiftAnchor }) | null
    >(null)
    return (
      <>
        <button onClick={outside}>outside</button>
        <TimeGrid
          data={data}
          plan={plan}
          roles={emptyFilter()}
          availability={emptyFilter()}
          search=""
          selection={selection}
          onSelect={(value, anchor) => setSelection({ ...value, anchor })}
          onMember={(memberId, anchor) =>
            setSelection({
              memberId,
              anchor,
              slotId: null,
              startsAt: plan.startsAt,
              endsAt: plan.endsAt,
            })
          }
          onCommit={() => {}}
        />
        {selection && (
          <ShiftSelectionPanel
            anchor={selection.anchor}
            selection={selection}
            slots={plan.slots}
            startsAt={plan.startsAt}
            endsAt={plan.endsAt}
            data={data}
            pending={false}
            onApply={() => null}
            onRemove={() => {}}
            onClose={() => setSelection(null)}
          />
        )}
      </>
    )
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  async function click(element: HTMLElement, pointer = false) {
    element.setPointerCapture = () => {}
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 300,
          clientY: 30,
        })
      )
      element.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          clientX: 300,
          clientY: 30,
        })
      )
      element.focus()
      element.dispatchEvent(
        new MouseEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 300,
          clientY: 30,
        })
      )
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
      element.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          detail: pointer ? 1 : 0,
          clientX: 300,
          clientY: 30,
        })
      )
    })
  }
  const input = () =>
    document.querySelector<HTMLInputElement>('input[aria-label="勤務の開始"]')
  try {
    await act(async () => root.render(<Screen />))
    const grids = host.querySelectorAll<HTMLButtonElement>(
      'button[aria-label$="の勤務時間を変更"]'
    )
    const first = grids[0],
      second = grids[1],
      control = host.querySelector("button")
    if (!first || !second || !control) throw new Error("Missing row")
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 0, 800, 56)
    )
    await click(first, true)
    expect(input()?.value).toBe("11:15")
    const action = (label: string) => {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent === label
      )
      if (!button) throw new Error(`Missing ${label}`)
      return button
    }
    const startInput = input()
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )
    if (!startInput || !valueDescriptor?.set)
      throw new Error("Missing time input")
    expect(action("キャンセル").disabled).toBe(false)
    expect(action("反映").disabled).toBe(false)
    await act(async () => {
      valueDescriptor.set?.call(startInput, "11:30")
      startInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(action("キャンセル").disabled).toBe(false)
    expect(action("反映").disabled).toBe(false)
    await act(async () => {
      valueDescriptor.set?.call(startInput, "11:15")
      startInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(action("キャンセル").disabled).toBe(false)
    expect(action("反映").disabled).toBe(false)
    expect(document.querySelector("#shift-time-title")?.textContent).toBe(
      "シフトを追加"
    )
    expect(document.querySelector('[data-slot="popover-arrow"]')).not.toBeNull()
    expect(document.querySelector("dialog")).toBeNull()
    await click(second)
    expect(input()?.value).toBe("09:00")
    expect(document.querySelectorAll("#shift-time-title")).toHaveLength(1)
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    })
    expect(input()).toBeNull()
    expect(document.activeElement).toBe(second)
    await click(first)
    await click(control)
    expect(outside).toHaveBeenCalledOnce()
    expect(input()).toBeNull()
    expect(document.activeElement).toBe(control)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
