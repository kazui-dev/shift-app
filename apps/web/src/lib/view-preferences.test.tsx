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
      include: ["default"],
      exclude: [],
    })
    return (
      <>
        <output>
          {value.include.join(",")}:{value.exclude.join(",")}
        </output>
        <button onClick={() => set({ include: [], exclude: [] })}>clear</button>
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
  expect(host.textContent).toBe("default:clear")
  await act(async () => host.querySelector("button")?.click())
  expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual({
    include: [],
    exclude: [],
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
  expect(host.textContent).toBe("remote:clear")
  await act(async () =>
    event(JSON.stringify({ values: ["legacy-excluded"], mode: "exclude" }))
  )
  expect(host.textContent).toBe(":legacy-excludedclear")
  await act(async () =>
    event(JSON.stringify({ include: ["yes"], exclude: ["no"] }))
  )
  expect(host.textContent).toBe("yes:noclear")
  await act(async () => {
    event(JSON.stringify({ values: 42, mode: "invalid" }))
  })
  expect(host.textContent).toBe("default:clear")
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: null, storageArea: localStorage })
    )
  })
  expect(host.textContent).toBe(":clear")
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

it("restores both filter sets and explicit clearing after recreating the page store", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  localStorage.clear()
  const host = document.createElement("div")
  let root = createRoot(host)
  function Filter() {
    const [value, set] = useViewPreference("both", filterPreferenceSchema, {
      include: ["default"],
      exclude: [],
    })
    return (
      <>
        <output>{JSON.stringify(value)}</output>
        <button onClick={() => set({ include: ["a"], exclude: ["b"] })}>
          both
        </button>
        <button onClick={() => set({ include: [], exclude: [] })}>clear</button>
      </>
    )
  }
  const mount = () =>
    act(async () =>
      root.render(
        <ViewPreferencesContext value={createViewPreferences("reload")}>
          <Filter />
        </ViewPreferencesContext>
      )
    )
  const reload = async () => {
    await act(async () => root.unmount())
    root = createRoot(host)
    await mount()
  }
  try {
    await mount()
    await act(async () => host.querySelectorAll("button")[0]?.click())
    await reload()
    expect(host.querySelector("output")?.textContent).toBe(
      JSON.stringify({ include: ["a"], exclude: ["b"] })
    )
    await act(async () => host.querySelectorAll("button")[1]?.click())
    await reload()
    expect(host.querySelector("output")?.textContent).toBe(
      JSON.stringify({ include: [], exclude: [] })
    )
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
