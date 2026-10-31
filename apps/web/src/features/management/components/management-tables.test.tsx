// @vitest-environment jsdom
import { act, useState, type ComponentProps, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import type { AdminUser } from "@workspace/shared/auth"
import { keys } from "@/app/data/keys"
import { YearTagManager } from "@/features/members/components/year-tag-manager"
import { getYearTags, reorderTags } from "@/features/members/api/tags"
import { UserManager } from "@/features/admin/components/user-manager"
import { YearManager } from "@/features/years/components/year-manager"
import { YearRoleManager } from "@/features/roles/components/year-role-manager"
import {
  createYear,
  setDefaultYear,
  reorderRoles,
  getYearRoles,
} from "@/features/years/api/years"
import {
  ManagementHeaderActionsContext,
  ManagementHeaderLeadingContext,
} from "../header-actions-context"
import type { ManagementScreenView } from "../management-context"

const drag = vi.hoisted(() => ({ move: (_from: string, _to: string) => {} }))
vi.mock("@workspace/ui/components/sortable-table", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@workspace/ui/components/sortable-table")
    >()
  return {
    ...original,
    SortableTable: (props: ComponentProps<typeof original.SortableTable>) => {
      drag.move = props.onMove
      return <original.SortableTable {...props} />
    },
  }
})
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; params?: Record<string, string> }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (url, [key, value]) => url.replace(`$${key}`, value),
        to
      )}
      {...props}
    >
      {children}
    </a>
  ),
}))
vi.mock("@/features/years/api/years", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/years/api/years")>()),
  getYearRoles: vi
    .fn<typeof getYearRoles>()
    .mockImplementation(async () => roles),
  reorderRoles: vi.fn<typeof reorderRoles>().mockResolvedValue(undefined),
  createYear: vi
    .fn<typeof createYear>()
    .mockResolvedValue({ year: { year: 2028, isDefault: false } }),
  setDefaultYear: vi
    .fn<typeof setDefaultYear>()
    .mockResolvedValue({ defaultYear: 2025 }),
}))
vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({
    open,
    children,
    title,
    onOpenChange,
  }: {
    open: boolean
    children: ReactNode
    title: string
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <dialog open aria-label={title}>
        <button onClick={() => onOpenChange(false)}>閉じる</button>
        {children}
      </dialog>
    ) : null,
}))
const tags = {
  tags: [
    { id: "tag-a", name: "配布済み", memberIds: ["a"] },
    { id: "tag-b", name: "確認待ち", memberIds: [] },
  ],
}
vi.mock("@/features/members/api/tags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/members/api/tags")>()),
  getYearTags: vi.fn<typeof getYearTags>().mockImplementation(async () => tags),
  reorderTags: vi.fn<typeof reorderTags>().mockResolvedValue(undefined),
}))
const users: AdminUser[] = [
  {
    id: "a",
    displayName: "佐藤",
    studentId: "26EC001",
    image: null,
    years: [2026],
    accessLevel: "member",
    discordLinked: true,
    isCurrentUser: false,
    sessionCount: 0,
    createdAt: 0,
  },
  {
    id: "b",
    displayName: "鈴木",
    studentId: "26EC002",
    image: null,
    years: [2025, 2026],
    accessLevel: "leader",
    discordLinked: true,
    isCurrentUser: false,
    sessionCount: 0,
    createdAt: 0,
  },
  {
    id: "c",
    displayName: "田中",
    studentId: "26EC003",
    image: null,
    years: [],
    accessLevel: "member",
    discordLinked: false,
    isCurrentUser: false,
    sessionCount: 0,
    createdAt: 0,
  },
]
const roles: Awaited<ReturnType<typeof getYearRoles>> = {
  authority: { systemAdmin: false, position: 2, permissions: ["role.manage"] },
  roles: [
    {
      id: "top",
      year: 2026,
      position: 2,
      name: "幹部",
      color: "#000000",
      permissions: ["role.manage"],
      memberCount: 1,
    },
    {
      id: "middle",
      year: 2026,
      position: 1,
      name: "受付",
      color: "#111111",
      permissions: ["shift.create"],
      memberCount: 1,
    },
    {
      id: "bottom",
      year: 2026,
      position: 0,
      name: "一般",
      color: "#222222",
      permissions: [],
      memberCount: 1,
    },
  ],
}
async function fixture(
  kind: "users" | "roles" | "years" | "tags",
  userRows = users
) {
  vi.mocked(reorderRoles).mockClear()
  vi.mocked(reorderTags).mockClear()
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
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(keys.adminUsers(), { users: userRows })
  client.setQueryData(keys.years(), {
    years: [
      { year: 2026, isDefault: true, canManage: true },
      { year: 2025, isDefault: false, canManage: true },
    ],
  })
  client.setQueryData(keys.yearRoles(2026), roles)
  client.setQueryData(keys.yearTags(2026), tags)
  vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined)
  function Demo() {
    const [actions, setActions] = useState<HTMLDivElement | null>(null)
    const [state, setState] = useState<ManagementScreenView>({
      search: "",
      scrollTop: 0,
    })
    const view = {
      ...state,
      save: (patch: Partial<ManagementScreenView>) =>
        setState((current) => ({
          ...current,
          ...patch,
          filters: { ...current.filters, ...patch.filters },
        })),
    }
    return (
      <ManagementHeaderActionsContext value={actions}>
        <ManagementHeaderLeadingContext value={actions}>
          <header>
            <div ref={setActions} />
          </header>
          {kind === "users" ? (
            <UserManager view={view} onDirtyChange={() => {}} />
          ) : kind === "tags" ? (
            <YearTagManager year={2026} view={view} onStatusChange={() => {}} />
          ) : kind === "roles" ? (
            <YearRoleManager year={2026} view={view} />
          ) : (
            <YearManager view={view} onDirtyChange={() => {}} />
          )}
        </ManagementHeaderLeadingContext>
      </ManagementHeaderActionsContext>
    )
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Demo />
      </QueryClientProvider>
    )
  )
  const button = (label: string) => {
    const result = [...document.querySelectorAll("button")].find(
      (item) =>
        item.getAttribute("aria-label") === label || item.textContent === label
    )
    if (!result) throw new Error(`Missing button: ${label}`)
    return result
  }
  const click = async (label: string) => {
    await act(async () => button(label).click())
  }
  const text = async (label: string, value: string) => {
    await click(`${label}で絞り込み`)
    const input = document.querySelector<HTMLInputElement>(
      `input[aria-label="${label}を検索"]`
    )
    if (!input) throw new Error(`Missing input: ${label}`)
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, value)
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(document.querySelector(`input[aria-label="${label}を検索"]`)).toBe(
      input
    )
    await click(`${label}で絞り込み`)
  }
  const option = async (label: string, value: string) => {
    await click(`${label}で絞り込み`)
    const element = [...document.querySelectorAll('[role="option"]')].find(
      (item) => item.textContent === value
    )
    if (!(element instanceof HTMLElement))
      throw new Error(`Missing option: ${value}`)
    await act(async () => element.click())
    expect(button(`${label}で絞り込み`).getAttribute("aria-expanded")).toBe(
      "true"
    )
    await click(`${label}で絞り込み`)
  }
  const rows = () =>
    [...host.querySelectorAll("tbody tr")].map((row) => row.textContent)
  return {
    host,
    button,
    click,
    text,
    option,
    rows,
    cleanup: async () => {
      await act(async () => root.unmount())
      client.clear()
      host.remove()
      vi.unstubAllGlobals()
    },
  }
}

it("combines user column filters without remounting input and selects the row for header actions", async () => {
  const f = await fixture("users")
  try {
    expect(f.host.querySelectorAll("thead th")).toHaveLength(5)
    await f.text("名前", "26EC")
    expect(f.rows()).toEqual(["条件に一致するユーザーはいません。"])
    await f.text("名前", "鈴木")
    await f.text("学籍番号", "001")
    expect(f.rows()).toEqual(["条件に一致するユーザーはいません。"])
    await f.text("学籍番号", "002")
    await f.option("参加年度", "2025年度")
    await f.option("システム権限", "委員会幹部")
    expect(f.rows()).toHaveLength(1)
    expect(f.rows()[0]).toContain("鈴木")
    const row = f.host.querySelector("tbody tr")
    if (!(row instanceof HTMLElement)) throw new Error("Missing user row")
    await act(async () => row.click())
    expect(
      f.host.querySelector<HTMLInputElement>('input[aria-label="鈴木を選択"]')
        ?.checked
    ).toBe(true)
    expect(f.host.querySelector("dialog")).toBeNull()
    expect(f.host.querySelector("header")?.textContent).toContain(
      "1人選択中年度を変更権限を変更選択を解除"
    )
    await f.click("選択を解除")
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "人選択中"
    )
  } finally {
    await f.cleanup()
  }
})
it("filters unjoined users through the year column", async () => {
  const f = await fixture("users")
  try {
    await f.option("参加年度", "未参加")
    expect(f.rows()).toHaveLength(1)
    expect(f.rows()[0]).toContain("田中")
  } finally {
    await f.cleanup()
  }
})
it("always shows drag handles, retains filters and respects role authority", async () => {
  const f = await fixture("roles")
  try {
    expect(f.host.querySelector("header")?.textContent).toContain(
      "ロールを作成"
    )
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "並べ替え"
    )
    expect(f.button("幹部を並べ替え").disabled).toBe(true)
    expect(f.button("受付を並べ替え").disabled).toBe(false)
    expect(f.button("一般を並べ替え").disabled).toBe(false)
    await f.text("ロール", "一般")
    await f.option("管理権限", "管理権限なし")
    expect(f.rows()).toHaveLength(1)
    expect(f.rows()[0]).toContain("一般")
    expect(f.button("一般を並べ替え").disabled).toBe(false)
    expect(f.button("ロールで絞り込み").disabled).toBe(false)
    expect(reorderRoles).not.toHaveBeenCalled()
  } finally {
    await f.cleanup()
  }
})

it("keeps year creation and default changes while filtering through column headers", async () => {
  vi.mocked(createYear).mockClear()
  vi.mocked(setDefaultYear).mockClear()
  const f = await fixture("years")
  try {
    expect(f.host.querySelector("header")?.textContent).toContain("年度を作成")
    await f.text("年度", "2025")
    expect(f.rows()).toHaveLength(1)
    const radio = f.host.querySelector<HTMLInputElement>(
      'input[aria-label="2025年度をデフォルトに設定"]'
    )
    if (!radio) throw new Error("Missing default year")
    await act(async () => radio.click())
    expect(setDefaultYear).toHaveBeenCalledExactlyOnceWith(2025)
    await f.text("年度", "")
    await f.option("デフォルト年度", "設定中")
    expect(f.rows()).toHaveLength(1)
    expect(f.rows()[0]).toContain("2026年度")
    await f.click("年度を作成")
    expect(createYear).not.toHaveBeenCalled()
    const input = f.host.querySelector<HTMLInputElement>("#new-year")
    if (!input) throw new Error("Missing new year input")
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, "2028")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await f.click("作成")
    expect(createYear).toHaveBeenCalledExactlyOnceWith({ year: 2028 })
    expect(f.host.querySelector("dialog")).toBeNull()
  } finally {
    await f.cleanup()
  }
})

it("updates visible column names for text, single, multiple and excluded choices without losing filter controls", async () => {
  const f = await fixture("users")
  const header = (index: number) =>
    f.host.querySelectorAll("thead th")[index + 1]?.textContent
  try {
    expect(header(0)).toBe("名前")
    await f.text("名前", "鈴木")
    expect(header(0)).toContain("鈴木")
    await f.text("名前", "")
    expect(header(0)).toBe("名前")
    await f.option("参加年度", "2025年度")
    expect(header(2)).toContain("2025年度")
    await f.option("参加年度", "2026年度")
    expect(header(2)).toContain("参加年度 (2)")
    await f.option("参加年度", "2026年度")
    await f.click("参加年度で絞り込み")
    await f.click("含まない")
    const option = [...document.querySelectorAll('[role="option"]')].find(
      (item) => item.textContent === "2025年度"
    )
    if (!(option instanceof HTMLElement))
      throw new Error("Missing excluded year")
    await act(async () => option.click())
    await f.click("参加年度で絞り込み")
    expect(header(2)).toContain("2025年度を除外")
    await f.click("参加年度で絞り込み")
    await f.click("全解除")
    await f.click("参加年度で絞り込み")
    expect(header(2)).toBe("参加年度")
  } finally {
    await f.cleanup()
  }
})

it("keeps ordering as a draft until explicitly saved and supports cancellation and retry", async () => {
  const f = await fixture("roles")
  try {
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "並び順を保存"
    )
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "キャンセル"
    )
    await act(async () => drag.move("middle", "bottom"))
    expect(f.rows()[1]).toContain("一般")
    expect(reorderRoles).not.toHaveBeenCalled()
    expect(f.button("並び順を保存").disabled).toBe(false)
    await act(async () => drag.move("bottom", "middle"))
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "並び順を保存"
    )
    await act(async () => drag.move("middle", "bottom"))
    await f.click("キャンセル")
    expect(f.rows()[1]).toContain("受付")
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "並び順を保存"
    )
    await act(async () => drag.move("middle", "bottom"))
    vi.mocked(reorderRoles).mockRejectedValueOnce(new Error("保存失敗"))
    await f.click("並び順を保存")
    expect(f.rows()[1]).toContain("一般")
    expect(f.button("並び順を保存").disabled).toBe(false)
    await f.click("並び順を保存")
    expect(reorderRoles).toHaveBeenLastCalledWith(2026, [
      "top",
      "bottom",
      "middle",
    ])
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "並び順を保存"
    )
  } finally {
    await f.cleanup()
  }
})
it("does not overwrite a role order changed by another operator", async () => {
  const f = await fixture("roles")
  try {
    await act(async () => drag.move("middle", "bottom"))
    vi.mocked(getYearRoles).mockResolvedValueOnce({
      ...roles,
      roles: [...roles.roles].reverse(),
    })
    await f.click("並び順を保存")
    expect(reorderRoles).not.toHaveBeenCalled()
    expect(f.button("キャンセル").disabled).toBe(false)
    await f.click("キャンセル")
    expect(f.rows()[0]).toContain("一般")
  } finally {
    await f.cleanup()
  }
})

it("sorts every user data column in both directions while retaining selection and filters", async () => {
  const f = await fixture(
    "users",
    users.map((user) => ({
      ...user,
      studentId:
        user.id === "a" ? "26EC10" : user.id === "b" ? "26EC2" : "26EC30",
      years: user.id === "a" ? [2024] : user.years,
      accessLevel: user.id === "c" ? "system_admin" : user.accessLevel,
    }))
  )
  const order = () =>
    [...f.host.querySelectorAll<HTMLInputElement>("tbody input")].map((input) =>
      input.getAttribute("aria-label")
    )
  const names = (values: string[]) => values.map((name) => `${name}を選択`)
  try {
    expect(order()).toEqual(names(["鈴木", "佐藤", "田中"]))
    const checkbox = f.host.querySelector<HTMLInputElement>(
      'input[aria-label="鈴木を選択"]'
    )
    if (!checkbox) throw new Error("Missing user checkbox")
    await act(async () => checkbox.click())
    await f.click("学籍番号")
    expect(order()).toEqual(names(["田中", "佐藤", "鈴木"]))
    await f.click("学籍番号")
    expect(order()).toEqual(names(["鈴木", "佐藤", "田中"]))
    const checkSort = async (column: string, ascending: string[]) => {
      await f.click(column)
      expect(order()).toEqual(names(ascending))
      await f.click(column)
      expect(order()).toEqual(names([...ascending].reverse()))
    }
    await checkSort("名前", ["佐藤", "田中", "鈴木"])
    await checkSort("参加年度", ["田中", "佐藤", "鈴木"])
    await checkSort("システム権限", ["佐藤", "鈴木", "田中"])
    expect(
      f.host.querySelector<HTMLInputElement>('input[aria-label="鈴木を選択"]')
        ?.checked
    ).toBe(true)
    await f.option("参加年度", "2026年度")
    expect(order()).toEqual(names(["鈴木"]))
    expect(
      f.host.querySelector('th[aria-sort="descending"]')?.textContent
    ).toBe("システム権限")
  } finally {
    await f.cleanup()
  }
})

it("uses the shared reorder draft, cancellation, persistence and member links for tags", async () => {
  const f = await fixture("tags")
  try {
    expect(f.host.querySelector("header")?.textContent).toContain("タグを作成")
    expect(
      f.host
        .querySelector('a[aria-label="配布済みのメンバーを表示"]')
        ?.getAttribute("href")
    ).toBe("/manage/tags/2026/tag-a")
    expect(f.rows()[0]).toContain("1人")
    await act(async () => drag.move("tag-a", "tag-b"))
    expect(f.rows()[0]).toContain("確認待ち")
    expect(reorderTags).not.toHaveBeenCalled()
    await f.click("キャンセル")
    expect(f.rows()[0]).toContain("配布済み")
    await act(async () => drag.move("tag-a", "tag-b"))
    await f.click("並び順を保存")
    expect(reorderTags).toHaveBeenCalledExactlyOnceWith(2026, [
      "tag-b",
      "tag-a",
    ])
    expect(f.host.querySelector("header")?.textContent).not.toContain(
      "並び順を保存"
    )
  } finally {
    await f.cleanup()
  }
})
