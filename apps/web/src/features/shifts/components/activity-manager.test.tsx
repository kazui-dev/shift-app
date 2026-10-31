// @vitest-environment jsdom
import { act, type ComponentProps } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, expect, it, vi } from "vite-plus/test"
import { ViewPreferencesProvider } from "@/app/view-preferences-provider"
import { ShiftViewProvider } from "../shift-view-provider"
import { keys } from "@/app/data/keys"
import type { FilterValue } from "@workspace/ui/lib/filters"
import { makeEditors } from "../../../../dev/fixtures"
import { ActivityManager } from "./activity-manager"

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    preload: _preload,
    ...props
  }: ComponentProps<"a"> & {
    to: string
    params?: { shiftId: string }
    preload?: string
  }) => (
    <a href={to.replace("$shiftId", params?.shiftId ?? "")} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("@workspace/ui/components/filter-menu", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@workspace/ui/components/filter-menu")
  >()),
  FilterMenu: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string
    value: FilterValue
    options: { value: string; label: string }[]
    onChange: (value: FilterValue) => void
  }) => (
    <select
      multiple
      aria-label={`${label}で絞り込み`}
      value={value.include}
      onChange={(event) =>
        onChange({
          ...value,
          include: [...event.target.selectedOptions].map((item) => item.value),
        })
      }
    >
      {options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}))
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})
const activities = makeEditors().map((data, index) => ({
  ...data.activity,
  active: index % 2 === 0,
  assignmentCount: 0,
  requirements: data.requirements,
  responsibleNames: [index % 2 ? "広報局" : "総務局"],
}))
async function fixture() {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(keys.activities(2026), { activities })
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <ViewPreferencesProvider user="table-test">
          <ShiftViewProvider>
            <ActivityManager year={2026} />
          </ShiftViewProvider>
        </ViewPreferencesProvider>
      </QueryClientProvider>
    )
  )
  return {
    host,
    rows: () =>
      [...host.querySelectorAll("tbody a")].map((item) => item.textContent),
    choose: async (label: string, values: string[]) => {
      const select = host.querySelector<HTMLSelectElement>(
        `select[aria-label="${label}で絞り込み"]`
      )
      if (!select) throw new Error(`Missing ${label}`)
      await act(async () => {
        for (const option of select.options)
          option.selected = values.includes(option.value)
        select.dispatchEvent(new Event("change", { bubbles: true }))
      })
    },
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      host.remove()
    },
  }
}

it("combines column filters and restores explicit clearing on a new page", async () => {
  const page = await fixture()
  try {
    expect(page.host.querySelectorAll("thead select")).toHaveLength(4)
    expect(page.rows()).toHaveLength(9)
    await page.choose("日付", ["2026-11-01", "2026-11-03"])
    expect(page.rows()).toHaveLength(6)
    await page.choose("日付", ["2026-11-01"])
    await page.choose("担当", ["総務局"])
    await page.choose("場所", ["1号館 正面入口"])
    await page.choose("状態", ["active"])
    expect(page.rows()).toEqual(["総合受付"])
    await page.choose("状態", ["inactive"])
    expect(page.rows()).toEqual([])
    await page.choose("日付", [])
    await page.choose("担当", [])
    await page.choose("場所", [])
    await page.choose("状態", [])
    expect(page.rows()).toHaveLength(9)
  } finally {
    await page.close()
  }
  const restored = await fixture()
  try {
    expect(restored.rows()).toHaveLength(9)
  } finally {
    await restored.close()
  }
})

it("keeps the column search mounted and focused while results change", async () => {
  const page = await fixture()
  try {
    const trigger = page.host.querySelector<HTMLButtonElement>(
      'button[aria-label="シフトで絞り込み"]'
    )
    if (!trigger) throw new Error("Missing search trigger")
    await act(async () => trigger.click())
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="シフトを検索"]'
    )
    if (!input) throw new Error("Missing search input")
    input.focus()
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )
    const typeAndCheckFocus = async (value: string) => {
      await act(async () => {
        descriptor?.set?.call(input, value)
        input.dispatchEvent(new Event("input", { bubbles: true }))
      })
      expect(document.querySelector('input[aria-label="シフトを検索"]')).toBe(
        input
      )
      expect(document.activeElement).toBe(input)
    }
    await typeAndCheckFocus("総")
    await typeAndCheckFocus("総合")
    await typeAndCheckFocus("総合受付")
    expect(page.rows()).toEqual(["総合受付", "総合受付", "総合受付"])
    await typeAndCheckFocus("総務局")
    expect(page.rows()).toEqual([])
    await typeAndCheckFocus("1号館")
    expect(page.rows()).toEqual([])
    await typeAndCheckFocus("")
    expect(page.rows()).toHaveLength(9)
  } finally {
    await page.close()
  }
})
