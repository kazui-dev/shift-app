// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { ShiftTimeline } from "./shift-timeline"

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
          minWidth="1000px"
          header={<span>09:00</span>}
        >
          <span>勤務</span>
        </ShiftTimeline>
      )
    })
    const [heading, body] = host.querySelectorAll<HTMLDivElement>(
      ".shift-timeline-scroll"
    )
    if (!heading || !body) throw new Error("Missing timeline scroll containers")
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
