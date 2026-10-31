// @vitest-environment jsdom
import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { FilterMenu } from "@workspace/ui/components/filter-menu"
import { SearchableSelect } from "@workspace/ui/components/searchable-select"
import { emptyFilter, type FilterValue } from "@workspace/ui/lib/filters"

it("does not discard saved values while options load and removes obsolete values only after success", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  const root = createRoot(host)
  function Demo({
    ready,
    options,
  }: {
    ready: boolean
    options: { value: string; label: string }[]
  }) {
    const [value, onChange] = useState<FilterValue>({
      include: [],
      exclude: ["kept", "deleted"],
    })
    return (
      <>
        <FilterMenu
          label="ロール"
          value={value}
          options={options}
          optionsReady={ready}
          onChange={onChange}
        />
        <output>{value.exclude.join(",")}</output>
      </>
    )
  }
  await act(async () => root.render(<Demo ready={false} options={[]} />))
  expect(host.querySelector("output")?.textContent).toBe("kept,deleted")
  await act(async () =>
    root.render(<Demo ready options={[{ value: "kept", label: "受付" }]} />)
  )
  expect(host.querySelector("output")?.textContent).toBe("kept")
  expect(host.querySelector("button")?.textContent).toBe("受付を除外")
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it("selects multiple values without closing, retains hidden selections, excludes, clears, and renders no empty-state spacer", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  function Demo() {
    const [value, onChange] = useState(emptyFilter)
    return (
      <>
        <FilterMenu
          label="タグ"
          value={value}
          onChange={onChange}
          options={[
            { value: "unset", label: "未設定" },
            { value: "a", label: "配布済み" },
            { value: "b", label: "確認済み" },
          ]}
        />
        <output>{JSON.stringify(value)}</output>
      </>
    )
  }
  const click = async (text: string) => {
    const element = [
      ...document.querySelectorAll(
        '[data-slot="filter-popup"] button,[data-slot="filter-popup"] [role=option]'
      ),
    ].find((item) => item.textContent === text)
    if (!(element instanceof HTMLElement))
      throw new Error(`Missing control ${text}`)
    await act(async () => element.click())
  }
  const search = async (value: string) => {
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="タグを検索"]'
    )
    if (!input) throw new Error("Missing search")
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, value)
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }
  try {
    await act(async () => root.render(<Demo />))
    const trigger = host.querySelector("button")
    if (!trigger) throw new Error("Missing trigger")
    expect(trigger.textContent).toBe("タグ")
    await act(async () => trigger.click())
    expect(document.querySelector('[data-slot="filter-popup"]')).not.toBeNull()
    expect(document.body.textContent).not.toContain("一致する候補")
    await click("配布済み")
    expect(trigger.textContent).toBe("配布済み")
    expect(trigger.title).toBe("タグ：含む 配布済み")
    await click("確認済み")
    expect(trigger.textContent).toBe("タグ (2)")
    expect(host.querySelector("output")?.textContent).toBe(
      JSON.stringify({ include: ["a", "b"], exclude: [] })
    )
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    await search("配布")
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(1)
    expect(host.querySelector("output")?.textContent).toContain('"a","b"')
    await click("配布済み")
    expect(trigger.textContent).toBe("確認済み")
    await click("含まない")
    // Changing the edited set keeps existing inclusions intact.
    expect(trigger.textContent).toBe("確認済み")
    await click("配布済み")
    expect(trigger.textContent).toBe("タグ (2)")
    expect(trigger.title).toBe("タグ：含む 確認済み ／ 含まない 配布済み")
    expect(
      JSON.parse(host.querySelector("output")?.textContent ?? "null")
    ).toEqual({ include: ["b"], exclude: ["a"] })
    await click("含む")
    expect(
      document.querySelector<HTMLInputElement>('input[aria-label="タグを検索"]')
        ?.value
    ).toBe("配布")
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(1)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    // Selecting the same option in the other set moves it, never creates a contradiction.
    await click("配布済み")
    expect(
      JSON.parse(host.querySelector("output")?.textContent ?? "null")
    ).toEqual({ include: ["b", "a"], exclude: [] })
    await click("含まない")
    await search("確認")
    await click("確認済み")
    expect(
      JSON.parse(host.querySelector("output")?.textContent ?? "null")
    ).toEqual({ include: ["a"], exclude: ["b"] })
    await search("存在しない")
    expect(document.body.textContent).toContain("一致する候補がありません。")
    await click("全解除")
    expect(trigger.textContent).toBe("タグ")
    expect(host.querySelector("output")?.textContent).toBe(
      JSON.stringify(emptyFilter())
    )
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="タグを検索"]'
    )
    if (!input) throw new Error("Missing search")
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
        })
      )
    )
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    await act(async () => trigger.click())
    expect(
      document.querySelector<HTMLInputElement>('input[aria-label="タグを検索"]')
        ?.value
    ).toBe("")
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})

it("does not reserve empty-state space in the shared single select when options exist", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <SearchableSelect
          aria-label="通常の選択"
          value="a"
          options={[{ value: "a", label: "受付" }]}
          searchLabel="ロールを検索"
          onValueChange={() => {}}
        />
      )
    )
    const trigger = host.querySelector("button")
    if (!trigger) throw new Error("Missing trigger")
    await act(async () => trigger.click())
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(1)
    expect(document.body.textContent).not.toContain("一致する候補")
    const option = document.querySelector('[role="option"]')
    if (!(option instanceof HTMLElement))
      throw new Error("Missing single option")
    await act(async () => option.click())
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
