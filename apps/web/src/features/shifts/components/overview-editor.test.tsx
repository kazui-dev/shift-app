// @vitest-environment jsdom
import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import type { ShiftOverview } from "@workspace/shared/shifts"
import { makeEditors } from "../../../../dev/fixtures"
import { getActivity } from "../api/activities"
import { OverviewGrid } from "./overview-grid"
import { OverviewEditor } from "./overview-editor"
import type { OverviewSelection } from "./overview-model"
import type { ShiftAnchor } from "./shift-anchor"

vi.mock("../api/activities", () => ({
  getActivity: vi.fn<typeof getActivity>(),
}))

it("switches the member, activity and times together and lets outside controls work on the first click", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const sources = makeEditors().slice(0, 2)
  const data: ShiftOverview = {
    canEdit: true,
    members: sources[0]?.members.slice(0, 2) ?? [],
    roles: [],
    activities: sources.map((source) => source.activity),
    availability: [],
    availabilityAnswers: [],
    assignments: sources.map((source, index) => {
      const slot = source.slots[index]
      const member = source.members[index]
      if (!slot || !member) throw new Error("fixture")
      return {
        id: `assignment-${index}`,
        slotId: slot.id,
        activityId: source.activity.id,
        memberId: member.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        attendance: null,
      }
    }),
  }
  vi.mocked(getActivity).mockImplementation(async (id) => {
    const source = sources.find((item) => item.activity.id === id)
    if (!source) throw new Error("fixture")
    return source
  })
  const apply = vi.fn<Parameters<typeof OverviewEditor>[0]["onApply"]>()
  const outside = vi.fn<() => void>()
  const select = vi.fn<Parameters<typeof OverviewGrid>[0]["onSelect"]>()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function View() {
    const [selection, setSelection] = useState<{
      value: OverviewSelection
      anchor: ShiftAnchor
    } | null>(null)
    return (
      <QueryClientProvider client={client}>
        <button onClick={outside}>一覧を更新</button>
        <OverviewGrid
          data={data}
          date="2026-11-01"
          now={0}
          rows={data.members.map((member) => ({
            member,
            assignments: data.assignments.filter(
              (a) => a.memberId === member.id
            ),
          }))}
          onSelect={(value, anchor) => {
            select(value, anchor)
            setSelection({ value, anchor })
          }}
          onInspect={() => {}}
        />
        {selection && (
          <OverviewEditor
            data={data}
            selection={selection.value}
            anchor={selection.anchor}
            drafts={{}}
            onApply={apply}
            onClose={() => setSelection(null)}
          />
        )}
      </QueryClientProvider>
    )
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const start = () =>
    document.querySelector<HTMLInputElement>('[aria-label="勤務の開始"]')?.value
  const end = () =>
    document.querySelector<HTMLInputElement>('[aria-label="勤務の終了"]')?.value
  async function click(element: HTMLElement) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 })
      )
      element.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0 })
      )
      element.focus()
      element.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, button: 0 })
      )
      element.click()
    })
  }
  try {
    await act(async () => root.render(<View />))
    const [first, second] = host.querySelectorAll<HTMLButtonElement>(
      "[data-assignment-key]"
    )
    if (!first || !second) throw new Error("Missing assignments")
    await click(first)
    expect(start()).toBe("09:00")
    expect(end()).toBe("11:00")
    const action = (label: string) => {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent === label
      )
      if (!button) throw new Error(`Missing ${label}`)
      return button
    }
    const startInput = document.querySelector<HTMLInputElement>(
      '[aria-label="勤務の開始"]'
    )
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )
    if (!startInput || !valueDescriptor?.set)
      throw new Error("Missing time input")
    expect(action("キャンセル").disabled).toBe(true)
    expect(action("反映").disabled).toBe(true)
    await act(async () => {
      valueDescriptor.set?.call(startInput, "09:15")
      startInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(action("キャンセル").disabled).toBe(false)
    await vi.waitFor(() => expect(action("反映").disabled).toBe(false))
    await act(async () => {
      valueDescriptor.set?.call(startInput, "09:00")
      startInput.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(action("キャンセル").disabled).toBe(true)
    expect(action("反映").disabled).toBe(true)
    expect(document.querySelector('[data-slot="popover-arrow"]')).not.toBeNull()
    expect(document.querySelector("#overview-time-title")?.textContent).toBe(
      data.members[0]?.displayName
    )
    expect(host.closest('[inert], [aria-hidden="true"]')).toBeNull()
    expect(document.querySelector('[aria-modal="true"]')).toBeNull()

    // Updating the target while the editor is mounted must reset the form too.
    await act(async () => second.click())
    expect(
      document.querySelector("#overview-time-title")?.textContent
    ).toContain(data.members[1]?.displayName)
    expect(
      document.querySelector('[aria-label="追加するシフト"]')?.textContent
    ).toContain("会場案内")
    expect(start()).toBe("10:00")
    expect(end()).toBe("12:00")

    // Real pointer/focus ordering must open the other target in a single click.
    await click(first)
    expect(start()).toBe("09:00")
    expect(document.querySelectorAll("#overview-time-title")).toHaveLength(1)
    const refresh = host.querySelector("button")
    if (!refresh) throw new Error("Missing outside control")
    await click(refresh)
    expect(outside).toHaveBeenCalledOnce()
    expect(start()).toBeUndefined()
    expect(document.activeElement).toBe(refresh)
    expect(apply).not.toHaveBeenCalled()

    await click(second)
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    })
    expect(start()).toBeUndefined()
    expect(document.activeElement).toBe(second)

    const blank = host.querySelector<HTMLButtonElement>(
      '[aria-label="佐藤 葵に勤務を追加"]'
    )
    const member = host.querySelector<HTMLButtonElement>(
      '[aria-label="佐藤 葵のシフトを確認"]'
    )
    if (!blank || !member) throw new Error("Missing member row")
    vi.spyOn(blank, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 0, 720, 56)
    )
    await act(async () => {
      blank.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1, clientX: 460 })
      )
    })
    expect(select.mock.lastCall?.[1].focus).toBe(blank)
    const position = select.mock.lastCall?.[1].position
    if (
      !position ||
      typeof position === "function" ||
      !("getBoundingClientRect" in position)
    )
      throw new Error("Missing point anchor")
    expect(position.getBoundingClientRect().left).toBe(460)
    expect(position.getBoundingClientRect().top).toBe(17)
    expect(position.getBoundingClientRect().bottom).toBe(37)
    expect(select.mock.lastCall?.[0].slotId).toBeNull()
    expect(document.querySelector("#overview-time-title")?.textContent).toBe(
      "シフトを追加"
    )
    expect(start()).toBe("14:00")
    expect(end()).toBe("15:00")
    expect(
      document.querySelector('[aria-label="追加するシフト"]')?.textContent
    ).toContain("シフトを選択")
    const visibleBar = first.querySelector<HTMLElement>("[data-shift-bar]")
    if (!visibleBar) throw new Error("Missing visible bar")
    vi.spyOn(visibleBar, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 17, 200, 20)
    )
    await act(async () =>
      first.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          detail: 1,
          clientX: 130,
          clientY: 5,
        })
      )
    )
    const existing = select.mock.lastCall?.[1].position
    if (
      !existing ||
      typeof existing === "function" ||
      !("getBoundingClientRect" in existing)
    )
      throw new Error("Missing existing assignment anchor")
    expect(existing.getBoundingClientRect()).toMatchObject({
      left: 130,
      top: 17,
      bottom: 37,
      width: 0,
    })
  } finally {
    await act(async () => root.unmount())
    host.remove()
    client.clear()
    vi.unstubAllGlobals()
  }
})
