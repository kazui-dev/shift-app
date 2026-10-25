// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { useCurrentTime } from "./use-current-time"

it("refreshes date defaults across midnight and on tab visibility, then clears its timer", async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-12-31T14:59:30Z"))
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  function Clock() {
    return <time>{useCurrentTime().toISOString()}</time>
  }
  try {
    await act(async () => root.render(<Clock />))
    expect(host.textContent).toBe("2026-12-31T14:59:30.000Z")
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(host.textContent).toBe("2026-12-31T15:00:30.000Z")
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"))
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(host.textContent).toBe("2027-01-01T00:00:00.000Z")
  } finally {
    await act(async () => root.unmount())
    host.remove()
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})
