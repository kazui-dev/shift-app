// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import type { ShiftNotice } from "@workspace/shared/shifts"
import { useVisibleNotices } from "./use-visible-notices"

it("switches notices at current-time boundaries without a reload and rechecks on return to the app", async () => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  const root = createRoot(host)
  const notice = (id: string, start: number, end: number): ShiftNotice => ({
    id,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    content: id,
  })
  const items = [
    notice("morning", 1000, 2000),
    notice("afternoon", 2000, 3000),
    notice("both", 1500, 2500),
  ]
  function View({ notices }: { notices?: ShiftNotice[] }) {
    return (
      <div>
        {useVisibleNotices(notices)
          .map((item) => item.content)
          .join(",")}
      </div>
    )
  }
  try {
    await act(async () => root.render(<View notices={items} />))
    expect(host.textContent).toBe("")
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(host.textContent).toBe("morning")
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(host.textContent).toBe("morning,both")
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(host.textContent).toBe("afternoon,both")
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(host.textContent).toBe("")
    vi.setSystemTime(1000)
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(host.textContent).toBe("morning")
    vi.setSystemTime(2000)
    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })
    expect(host.textContent).toBe("afternoon,both")
    expect(vi.getTimerCount()).toBe(1)
    await act(async () =>
      root.render(<View notices={[notice("changed", 0, 5000)]} />)
    )
    expect(host.textContent).toBe("changed")
    await act(async () => root.render(<View />))
    expect(host.textContent).toBe("")
  } finally {
    await act(async () => root.unmount())
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})
