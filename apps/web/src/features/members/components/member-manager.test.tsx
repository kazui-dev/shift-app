import type { FilterValue } from "@workspace/ui/lib/filters"
// @vitest-environment jsdom
import { act, type ComponentProps, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { keys } from "@/app/data/keys"
import { ApiError } from "@/lib/http/client"
import {
  deactivateYearMembership,
  changeMemberRoles,
} from "@/features/years/api/years"
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
  deactivateYearMembership: vi.fn<typeof deactivateYearMembership>(),
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
vi.mock("@workspace/ui/components/filter-menu", () => ({
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
        value={value.values}
        disabled={disabled}
        onChange={(event) =>
          onChange({
            ...value,
            values: [...event.target.selectedOptions].map(
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
        onClick={() => onChange({ ...value, mode: "exclude" })}
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
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemberManager
          year={2026}
          view={{ search: "", filter: "", save }}
          onDirtyChange={() => {}}
        />
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
    [...host.querySelectorAll("tbody tr")].map((row) =>
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
    await select("鈴木")
    await choose("タグで絞り込み", "tag")
    expect(names()).toEqual(["佐藤"])
    expect(host.textContent).toContain("表示外1人")
    expect(host.textContent).toContain("参加解除")
    await choose("ロールで絞り込み", "unset")
    expect(names()).toEqual([undefined])
    await choose("タグで絞り込み", "unset")
    expect(names()).toEqual(["田中"])
    expect(save).toHaveBeenCalledWith({
      filters: {
        roles: { values: ["unset"], mode: "include" },
        tags: { values: ["unset"], mode: "include" },
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
it("uses the same chips and change choices for roles and tags", async () => {
  const { host, button, cleanup } = await fixture()
  try {
    const roleCell = host.querySelector<HTMLButtonElement>(
      'button[aria-label="佐藤のロールを変更"]'
    )
    const tagCell = host.querySelector<HTMLButtonElement>(
      'button[aria-label="佐藤のタグを変更"]'
    )
    expect(roleCell?.querySelector("span span")?.className).toBe(
      tagCell?.querySelector("span span")?.className
    )
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
it("confirms bulk removal and retains only failed members for retry", async () => {
  const { host, button, select, cleanup } = await fixture()
  const remove = vi.mocked(deactivateYearMembership)
  remove
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(
      new ApiError("今後の勤務があります。", 409, "FUTURE_SHIFTS")
    )
  try {
    await select("佐藤")
    await select("鈴木")
    await act(async () => button("参加解除").click())
    expect(host.querySelector("aside")?.textContent).toContain(
      "2人の年度への参加を解除"
    )
    expect(remove).not.toHaveBeenCalled()
    await act(async () => button("確認").click())
    expect(remove.mock.calls).toEqual([
      [2026, "a"],
      [2026, "b"],
    ])
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "鈴木：今後の勤務があります。"
    )
    expect(
      host.querySelector<HTMLInputElement>('input[aria-label="佐藤を選択"]')
        ?.checked
    ).toBe(false)
    expect(
      host.querySelector<HTMLInputElement>('input[aria-label="鈴木を選択"]')
        ?.checked
    ).toBe(true)
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
