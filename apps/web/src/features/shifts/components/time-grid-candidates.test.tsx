// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { emptyFilter } from "@workspace/ui/lib/filters"
import { makeEditors } from "../../../../dev/fixtures"
import { planOf } from "./use-shift-plan"
import { TimeGrid } from "./time-grid"
import type { ShiftSelection } from "./shift-selection-panel"

it("ties details and candidates to the selected interval across minute-level staffing changes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  const source = makeEditors()[0]
  if (!source) throw new Error("Missing editor fixture")
  const members = source.members.slice(0, 3)
  const [assigned, early, later] = members
  if (!assigned || !early || !later) throw new Error("Missing members")
  const at = (time: string) =>
    new Date(`2026-11-01T${time}:00+09:00`).toISOString()
  const data = {
    ...source,
    activity: {
      ...source.activity,
      startsAt: at("09:00"),
      endsAt: at("10:00"),
    },
    members,
    requirements: [
      {
        id: "first",
        startsAt: at("09:00"),
        endsAt: at("09:12"),
        requiredCount: 3,
      },
      {
        id: "second",
        startsAt: at("09:12"),
        endsAt: at("09:27"),
        requiredCount: 8,
      },
      {
        id: "third",
        startsAt: at("09:27"),
        endsAt: at("10:00"),
        requiredCount: 0,
      },
    ],
    slots: [
      {
        id: "work",
        startsAt: at("09:00"),
        endsAt: at("09:18"),
        capacity: null,
        memberIds: [assigned.id],
      },
    ],
    availability: [
      { memberId: early.id, startsAt: at("09:12"), endsAt: at("09:18") },
      { memberId: later.id, startsAt: at("09:18"), endsAt: at("09:27") },
    ],
    otherAssignments: [],
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const onSelect = vi.fn<(selection: ShiftSelection) => void>()
  async function render(selecting = false) {
    await act(async () =>
      root.render(
        <TimeGrid
          data={data}
          plan={planOf(data)}
          roles={emptyFilter()}
          availability={emptyFilter()}
          search=""
          selection={null}
          onSelect={onSelect}
          onCommit={() => {}}
          onMember={() => {}}
          assignmentSelection={{
            active: selecting,
            available: [],
            keys: [],
            toggle: () => {},
            replace: () => {},
          }}
        />
      )
    )
  }
  function button(name: string) {
    const result = Array.from(document.querySelectorAll("button")).find(
      (item) =>
        item.getAttribute("aria-label") === name || item.textContent === name
    )
    if (!result) throw new Error(`Missing button: ${name}`)
    return result
  }
  async function select(time: string) {
    const input = host.querySelector<HTMLInputElement>('input[type="range"]')
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )
    if (!input || !descriptor?.set) throw new Error("Missing cursor")
    await act(async () => {
      descriptor.set?.call(input, String(Date.parse(at(time))))
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }
  const detail = () =>
    document.querySelector('[aria-label="選択区間の人数と候補"]')
  const visible = () =>
    Array.from(host.querySelectorAll("[data-shift-member]")).map(
      (item) => item.textContent
    )
  try {
    await render()
    expect(detail()).toBeNull()
    expect(visible()).toHaveLength(3)
    await select("09:11")
    expect(detail()?.textContent).toContain("09:00–09:12")
    expect(detail()?.querySelector("output")?.textContent).toBe(
      "配置 1人/ 必要 3人"
    )
    await select("09:12")
    expect(detail()?.textContent).toContain("09:12–09:18")
    expect(detail()?.querySelector("output")?.textContent).toBe(
      "配置 1人/ 必要 8人"
    )
    await act(async () => button("候補を表示").click())
    expect(visible()).toHaveLength(1)
    expect(visible()[0]).toContain(early.displayName)
    const name = host.querySelector<HTMLButtonElement>("[data-shift-member]")
    if (!name) throw new Error("Missing candidate")
    await act(async () => name.click())
    expect(onSelect).toHaveBeenCalledWith(
      {
        memberId: early.id,
        slotId: null,
        startsAt: at("09:12"),
        endsAt: at("09:18"),
      },
      { position: name, focus: name }
    )
    await act(async () => button("次の区間").click())
    expect(visible()).toHaveLength(3)
    expect(detail()?.textContent).toContain("09:18–09:27")
    expect(detail()?.querySelector("output")?.textContent).toBe(
      "配置 0人/ 必要 8人"
    )
    await act(async () => button("候補を表示").click())
    expect(visible()).toHaveLength(1)
    expect(visible()[0]).toContain(later.displayName)
    await act(async () => button("区間の選択を解除").click())
    expect(detail()).toBeNull()
    expect(visible()).toHaveLength(3)
    await select("09:27")
    expect(detail()?.querySelector("output")?.textContent).toBe(
      "配置 0人/ 必要 0人"
    )
    expect(button("候補を表示").disabled).toBe(true)
    await act(async () => button("前の区間").click())
    expect(detail()?.textContent).toContain("09:18–09:27")
    await act(async () => button("候補を表示").click())
    await render(true)
    expect(detail()).toBeNull()
    expect(visible()).toHaveLength(3)
    await render()
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    )
    expect(detail()).toBeNull()
    expect(visible()).toHaveLength(3)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
