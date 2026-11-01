// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { ShiftTimeline } from "./shift-timeline"
import { TimelineAxis } from "./timeline-axis"
import { ShiftWorkspaceToolbar } from "./shift-workspace-toolbar"
import {
  createViewPreferences,
  ViewPreferencesContext,
} from "@/lib/view-preferences"

it("keeps the time axis and work rows aligned when either is scrolled horizontally", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => {
      root.render(
        <ShiftTimeline
          label="シフト"
          start={0}
          end={36_000_000}
          header={<span>09:00</span>}
          toolbar={<input aria-label="メンバー検索" />}
        >
          <span>勤務</span>
        </ShiftTimeline>
      )
    })
    const [heading, body] = host.querySelectorAll<HTMLDivElement>(
      ".shift-timeline-scroll"
    )
    if (!heading || !body) throw new Error("Missing timeline scroll containers")
    const search = host.querySelector("input")
    expect(search?.closest(".sticky-header")).toBe(
      heading.closest(".sticky-header")
    )
    expect(search?.closest(".shift-timeline-scroll")).toBeNull()
    async function scroll(
      source: HTMLDivElement,
      target: HTMLDivElement,
      left: number
    ) {
      await act(async () => {
        source.scrollLeft = left
        source.dispatchEvent(new Event("scroll"))
      })
      expect(target.scrollLeft).toBe(left)
      // The event from synchronizing the other container must not move it back.
      await act(async () => {
        target.dispatchEvent(new Event("scroll"))
      })
      expect(source.scrollLeft).toBe(left)
    }
    // Body gestures, header gestures, and returning to the start must all sync.
    await scroll(body, heading, 240)
    await scroll(heading, body, 480)
    await scroll(body, heading, 0)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})

it("previews drag widths without writing storage, then persists and synchronizes other views and tabs", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const key = "shift-app:view:v1:timeline-test:shifts:timeline-hour-width"
  localStorage.removeItem(key)
  const store = createViewPreferences("timeline-test")
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const start = Date.parse("2026-11-01T09:00:00+09:00")
  const end = start + 9 * 3_600_000
  function Demo() {
    return (
      <ViewPreferencesContext value={store}>
        {["シフト別", "全体"].map((label) => (
          <ShiftTimeline
            key={label}
            label={label}
            start={start}
            end={end}
            toolbar={<ShiftWorkspaceToolbar label={`${label}の操作`} />}
            header={
              <div className="flex">
                <TimelineAxis start={start} end={end} />
              </div>
            }
          >
            <span>勤務</span>
          </ShiftTimeline>
        ))}
      </ViewPreferencesContext>
    )
  }
  const widths = () =>
    Array.from(host.querySelectorAll<HTMLElement>(".shift-timeline"), (node) =>
      node.style.getPropertyValue("--shift-hour-width")
    )
  try {
    await act(async () => root.render(<Demo />))
    expect(widths()).toEqual(["96px", "96px"])
    const axis = host.querySelector<HTMLFieldSetElement>(
      '[aria-label="時間軸の目盛り"]'
    )
    const handle = axis?.querySelector<HTMLButtonElement>(
      'button[aria-label="10:00の区切りで時間軸の幅を変更"]'
    )
    if (!axis || !handle) throw new Error("Missing resize handle")
    axis.setPointerCapture = () => {}
    axis.releasePointerCapture = () => {}
    await act(async () =>
      handle.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 96 })
      )
    )
    await act(async () =>
      axis.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 144 })
      )
    )
    expect(widths()).toEqual(["144px", "96px"])
    expect(localStorage.getItem(key)).toBeNull()
    await act(async () =>
      axis.dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, clientX: 144 })
      )
    )
    expect(widths()).toEqual(["144px", "144px"])
    expect(localStorage.getItem(key)).toBe("144")
    expect(axis.textContent).toContain("09:30")
    await act(async () =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: "240",
          storageArea: localStorage,
        })
      )
    )
    expect(widths()).toEqual(["240px", "240px"])
    expect(axis.textContent).toContain("09:15")
    await act(async () =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: "-1",
          storageArea: localStorage,
        })
      )
    )
    expect(widths()).toEqual(["96px", "96px"])
    const keyboardHandle = axis.querySelector<HTMLButtonElement>(
      'button[aria-label="10:00の区切りで時間軸の幅を変更"]'
    )
    if (!keyboardHandle) throw new Error("Missing keyboard resize handle")
    await act(async () =>
      keyboardHandle.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      )
    )
    expect(widths()).toEqual(["104px", "104px"])
    await act(async () => root.render(<span>別の画面</span>))
    await act(async () => root.render(<Demo />))
    expect(widths()).toEqual(["104px", "104px"])
  } finally {
    await act(async () => root.unmount())
    host.remove()
    localStorage.removeItem(key)
    vi.unstubAllGlobals()
  }
})
