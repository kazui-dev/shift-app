// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import {
  createViewPreferences,
  ViewPreferencesContext,
  filterPreferenceSchema,
  useViewPreference,
} from "./view-preferences"

it("validates stored values, keeps empty selections, follows storage events and tolerates storage failures", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  localStorage.clear()
  const key = "shift-app:view:v1:alice:filter"
  localStorage.setItem(key, "{broken")
  const host = document.createElement("div")
  const root = createRoot(host)
  const store = createViewPreferences("alice")
  function Filter() {
    const [value, set] = useViewPreference("filter", filterPreferenceSchema, {
      values: ["default"],
      mode: "include",
    })
    return (
      <>
        <output>
          {value.values.join(",")}:{value.mode}
        </output>
        <button onClick={() => set({ values: [], mode: "exclude" })}>
          clear
        </button>
      </>
    )
  }
  await act(async () =>
    root.render(
      <ViewPreferencesContext value={store}>
        <Filter />
      </ViewPreferencesContext>
    )
  )
  expect(host.textContent).toBe("default:includeclear")
  await act(async () => host.querySelector("button")?.click())
  expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual({
    values: [],
    mode: "exclude",
  })
  const event = (value: string) =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: value,
        storageArea: localStorage,
      })
    )
  await act(async () => {
    event(JSON.stringify({ values: ["remote"], mode: "include" }))
  })
  expect(host.textContent).toBe("remote:includeclear")
  await act(async () => {
    event(JSON.stringify({ values: 42, mode: "invalid" }))
  })
  expect(host.textContent).toBe("default:includeclear")
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: null, storageArea: localStorage })
    )
  })
  expect(host.textContent).toBe(":excludeclear")
  await act(async () => root.unmount())
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("unavailable")
  })
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("unavailable")
    })
  const unavailable = createViewPreferences("bob")
  expect(unavailable.get("filter")).toBeNull()
  unavailable.set("filter", "saved")
  expect(unavailable.get("filter")).toBe("saved")
  read.mockRestore()
  write.mockRestore()
  vi.unstubAllGlobals()
})
