import {
  ManagementHeaderActionsContext,
  ManagementHeaderLeadingContext,
} from "@/features/management/header-actions-context"
import type { FilterValue } from "@workspace/ui/lib/filters"
// @vitest-environment jsdom
import { act, useState, type ComponentProps, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { keys } from "@/app/data/keys"
import { changeMemberRoles } from "@/features/years/api/years"
import { MemberManager } from "./member-manager"

vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router"
  )),
  Link: ({ to, children, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("@/features/years/api/years", async () => ({
  ...(await vi.importActual<typeof import("@/features/years/api/years")>(
    "@/features/years/api/years"
  )),
  changeMemberRoles: vi.fn<typeof changeMemberRoles>(),
}))
vi.mock("@workspace/ui/lib/toast", () => ({
  toast: {
    success: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>(),
  },
}))
vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({
    children,
    title,
    onOpenChange,
  }: {
    children: ReactNode
    title: string
    onOpenChange: (open: boolean) => void
  }) => (
    <dialog open aria-label={title}>
      <button onClick={() => onOpenChange(false)}>閉じる</button>
      {children}
    </dialog>
  ),
}))
vi.mock("@/components/select-field", () => ({
  SelectField: ({
    value,
    options,
    onValueChange,
    disabled,
    "aria-label": label,
  }: {
    value: string
    options: { value: string; label: string }[]
    onValueChange: (value: string) => void
    disabled: boolean
    "aria-label": string
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
    disabled,
  }: {
    label: string
    value: FilterValue
    options: { value: string; label: string }[]
    onChange: (value: FilterValue) => void
    disabled: boolean
  }) => (
    <>
      <select
        multiple
        aria-label={`${label}で絞り込み`}
        value={value.include}
        disabled={disabled}
        onChange={(event) =>
          onChange({
            ...value,
            include: [...event.target.selectedOptions].map(
              (option) => option.value
            ),
          })
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        aria-label={`${label}を除外`}
        onClick={() => onChange({ include: [], exclude: value.include })}
      >
        除外
      </button>
    </>
  ),
}))
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({
    title,
    description,
    onConfirm,
    onCancel,
  }: {
    title: string
    description: ReactNode
    onConfirm: () => void
    onCancel: () => void
  }) => (
    <aside>
      {title}
      {description}
      <button onClick={onConfirm}>確認</button>
      <button onClick={onCancel}>戻る</button>
    </aside>
  ),
}))
const role = { id: "role", name: "受付" }
const otherRole = { id: "other-role", name: "広報" }
const tag = { id: "tag", name: "配布済み", memberIds: ["a"] }
const members = [
  {
    id: "a",
    displayName: "佐藤",
    studentId: "26EC001",
    image: null,
    roles: [role],
  },
  {
    id: "b",
    displayName: "鈴木",
    studentId: "26EC002",
    image: null,
    roles: [role, otherRole],
  },
  {
    id: "c",
    displayName: "田中",
    studentId: "26EC003",
    image: null,
    roles: [],
  },
]
async function fixture() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(keys.roster(2026), { members })
  client.setQueryData(keys.yearRoles(2026), { roles: [role, otherRole] })
  client.setQueryData(keys.yearTags(2026), {
    tags: [tag, { id: "other-tag", name: "確認済み", memberIds: ["b"] }],
  })
  vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined)
  const save = vi.fn<
    (
      patch: Partial<{
        search: string
        filter: string
        filters: Record<string, FilterValue>
      }>
    ) => void
  >()
  function List() {
    const [actions, setActions] = useState<HTMLDivElement | null>(null)
    const [view, setView] = useState<
      Omit<ComponentProps<typeof MemberManager>["view"], "save">
    >({ search: "" })
    return (
      <ManagementHeaderActionsContext value={actions}>
        <ManagementHeaderLeadingContext value={actions}>
          <div ref={setActions} />
          <MemberManager
            year={2026}
            view={{
              ...view,
              save: (patch) => {
                save(patch)
                setView((current) => ({
                  ...current,
                  ...patch,
                  filters: { ...current.filters, ...patch.filters },
                }))
              },
            }}
            onDirtyChange={() => {}}
          />
        </ManagementHeaderLeadingContext>
      </ManagementHeaderActionsContext>
    )
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <List />
      </QueryClientProvider>
    )
  )
  const button = (text: string) => {
    const element = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === text
    )
    if (!element) throw new Error(`missing button ${text}`)
    return element
  }
  const choose = async (label: string, value: string | string[]) => {
    const input = [...host.querySelectorAll("select")].find(
      (item) => item.getAttribute("aria-label") === label
    )
    if (!input) throw new Error(`missing filter ${label}`)
    await act(async () => {
      for (const option of input.options)
        option.selected = (
          typeof value === "string" ? [value] : value
        ).includes(option.value)
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
  }
  const select = async (name: string) => {
    const input = [...host.querySelectorAll("input")].find(
      (item) => item.getAttribute("aria-label") === `${name}を選択`
    )
    if (!input) throw new Error(`missing member ${name}`)
    await act(async () => input.click())
  }
  const names = () =>
    [...host.querySelectorAll("tbody tr:has(input)")].map((row) =>
      row
        .querySelector("input")
        ?.getAttribute("aria-label")
        ?.replace(/を選択$/, "")
    )
  const cleanup = async () => {
    await act(async () => root.unmount())
    client.clear()
    host.remove()
    vi.unstubAllGlobals()
  }
  return { host, button, choose, select, names, save, cleanup }
}
it("combines matching role/tag column filters, supports unset, and retains hidden selections", async () => {
  const { host, choose, select, names, save, button, cleanup } = await fixture()
  try {
    expect(host.querySelectorAll("thead select")).toHaveLength(2)
    expect(host.querySelector("tbody")?.textContent).not.toContain("参加解除")
    expect(host.textContent).not.toContain("参加解除")
    expect(host.textContent).not.toContain("メンバーを追加")
    expect(host.textContent).not.toContain("タグを管理")
    await select("鈴木")
    await choose("タグで絞り込み", "tag")
    expect(names()).toEqual(["佐藤"])
    expect(host.textContent).toContain("表示外1人")
    expect(host.textContent).not.toContain("参加解除")
    await choose("ロールで絞り込み", "unset")
    expect(names()).toEqual([])
    await choose("タグで絞り込み", "unset")
    expect(names()).toEqual(["田中"])
    expect(save).toHaveBeenCalledWith({
      filters: {
        tags: { include: ["unset"], exclude: [] },
      },
    })
    await act(async () => button("絞り込みを解除").click())
    expect(names()).toEqual(["佐藤", "鈴木", "田中"])
    expect(
      host.querySelector<HTMLInputElement>('input[aria-label="鈴木を選択"]')
        ?.checked
    ).toBe(true)
  } finally {
    await cleanup()
  }
})
it("opens the existing role and tag editors from plain table cells", async () => {
  const { host, button, cleanup } = await fixture()
  try {
    const roleCell = host.querySelector<HTMLButtonElement>(
      'button[aria-label="佐藤のロールを変更"]'
    )
    const tagCell = host.querySelector<HTMLButtonElement>(
      'button[aria-label="佐藤のタグを変更"]'
    )
    expect(roleCell?.textContent).toBe("受付")
    expect(tagCell?.textContent).toBe("配布済み")
    await act(async () => roleCell?.click())
    expect(host.querySelector("dialog")?.getAttribute("aria-label")).toBe(
      "ロールを変更"
    )
    const choices = () =>
      [
        ...(host.querySelector("dialog select")?.querySelectorAll("option") ??
          []),
      ].map((item) => item.textContent)
    expect(choices()).toEqual(["変更しない", "付与", "解除"])
    await act(async () => button("閉じる").click())
    await act(async () => tagCell?.click())
    expect(host.querySelector("dialog")?.getAttribute("aria-label")).toBe(
      "タグを変更"
    )
    expect(choices()).toEqual(["変更しない", "付与", "解除"])
  } finally {
    await cleanup()
  }
})

it("combines multiple roles and tags with AND between columns, supports untagged and excluding a specific tag", async () => {
  const { host, choose, names, button, cleanup } = await fixture()
  try {
    await choose("タグで絞り込み", ["tag", "other-tag"])
    expect(names()).toEqual(["佐藤", "鈴木"])
    await choose("ロールで絞り込み", ["other-role"])
    expect(names()).toEqual(["鈴木"])
    await choose("ロールで絞り込み", ["role", "other-role"])
    expect(names()).toEqual(["佐藤", "鈴木"])
    await act(async () => button("絞り込みを解除").click())
    await choose("タグで絞り込み", "unset")
    expect(names()).toEqual(["田中"])
    await choose("タグで絞り込み", "tag")
    const exclude = host.querySelector<HTMLButtonElement>(
      'button[aria-label="タグを除外"]'
    )
    if (!exclude) throw new Error("Missing exclusion control")
    await act(async () => exclude.click())
    expect(names()).toEqual(["鈴木", "田中"])
  } finally {
    await cleanup()
  }
})

it("selects only visible rows without dropping hidden selections and persists sort changes", async () => {
  const { host, select, choose, names, button, save, cleanup } = await fixture()
  try {
    const row = host.querySelector("tbody tr")
    if (!(row instanceof HTMLElement)) throw new Error("Missing member row")
    await act(async () => row.click())
    expect(host.textContent).toContain("1人選択中")
    await select("佐藤")
    expect(host.textContent).not.toContain("人選択中")
    await select("鈴木")
    await choose("タグで絞り込み", "tag")
    const all = host.querySelector<HTMLInputElement>(
      'input[aria-label="表示中のメンバーをすべて選択"]'
    )
    if (!all) throw new Error("Missing select-all")
    await act(async () => all.click())
    expect(host.textContent).toContain("2人選択中")
    await act(async () => all.click())
    expect(host.textContent).toContain("1人選択中")
    expect(host.textContent).toContain("表示外1人")
    await choose("タグで絞り込み", [])
    await act(async () => button("学籍番号").click())
    expect(names()).toEqual(["田中", "鈴木", "佐藤"])
    expect(save).toHaveBeenCalledWith({
      sort: { column: "studentId", descending: true },
    })
    expect(host.querySelector('th[aria-sort="descending"]')?.textContent).toBe(
      "学籍番号"
    )
  } finally {
    await cleanup()
  }
})

it("filters name and student ID independently and clears both through the common reset", async () => {
  const { host, names, button, save, cleanup } = await fixture()
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  async function input(label: string, value: string) {
    const trigger = host.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}で絞り込み"]`
    )
    if (!trigger) throw new Error("Missing text filter")
    await act(async () => trigger.click())
    const field = document.querySelector<HTMLInputElement>(
      `input[aria-label="${label}を検索"]`
    )
    if (!field) throw new Error("Missing text input")
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(field, value)
      field.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => trigger.click())
  }
  try {
    await input("名前", "26EC")
    expect(names()).toEqual([])
    await input("名前", "佐藤")
    expect(names()).toEqual(["佐藤"])
    await input("学籍番号", "002")
    expect(names()).toEqual([])
    await input("学籍番号", "001")
    expect(names()).toEqual(["佐藤"])
    expect(save).toHaveBeenCalledWith({ textFilters: { studentId: "001" } })
    await act(async () => button("絞り込みを解除").click())
    expect(names()).toEqual(["佐藤", "鈴木", "田中"])
    expect(save).toHaveBeenCalledWith({
      search: "",
      textFilters: {},
      filters: {
        roles: { include: [], exclude: [] },
        tags: { include: [], exclude: [] },
      },
    })
  } finally {
    await cleanup()
  }
})
