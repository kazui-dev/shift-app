// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vite-plus/test"
import { AttendanceColorsControl } from "./attendance-colors-control"
import { useAttendanceColors } from "./use-attendance-colors"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function Control() {
  const colors = useAttendanceColors()
  return (
    <AttendanceColorsControl
      checked={colors.enabled}
      onCheckedChange={colors.toggle}
    />
  )
}

async function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  const root = createRoot(host)
  await act(async () => root.render(<Control />))
  const button = host.querySelector<HTMLButtonElement>('[role="switch"]')
  if (!button) throw new Error("Missing toggle")
  return {
    button,
    unmount: () => act(async () => root.unmount()),
    toggle: () => act(async () => button.click()),
  }
}

it("restores both toggle states after remounting from browser storage", async () => {
  const first = await mount()
  expect(first.button.closest("label")?.textContent).toContain("勤怠状況")
  expect(first.button.getAttribute("aria-checked")).toBe("false")
  await first.toggle()
  expect(first.button.getAttribute("aria-checked")).toBe("true")
  await first.unmount()

  const second = await mount()
  expect(second.button.getAttribute("aria-checked")).toBe("true")
  await second.toggle()
  await second.unmount()

  const third = await mount()
  expect(third.button.getAttribute("aria-checked")).toBe("false")
  await third.unmount()
})

it("still toggles when storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Storage unavailable")
  })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable")
  })
  const control = await mount()
  expect(control.button.getAttribute("aria-checked")).toBe("false")
  await control.toggle()
  expect(control.button.getAttribute("aria-checked")).toBe("true")
  await control.unmount()
})
