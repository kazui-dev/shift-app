// @vitest-environment jsdom
import { act, type ComponentProps } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { ManagementLayout } from "./layout"
import { ManagementPage } from "./page"

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({
    useRouteContext: () => ({ state: { member: { accessLevel: "member" } } }),
  }),
  useRouterState: () => "/manage/shifts",
  Link: ({ to, children, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => (
    <ManagementPage header={<h2>シフト</h2>}>
      <p>一覧</p>
    </ManagementPage>
  ),
}))
vi.mock("@/features/management/use-management-year", () => ({
  useManagementYearState: () => ({
    year: 2026,
    years: [{ year: 2026 }, { year: 2025 }],
    selectYear: vi.fn<(year: number | null) => void>(),
  }),
}))

it("hides display-year controls and opens mobile navigation from the single page header", async () => {
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
    await act(async () => root.render(<ManagementLayout />))
    expect(host.querySelector("h1")).toBeNull()
    expect(host.querySelectorAll("header")).toHaveLength(1)
    expect(host.querySelector('[aria-label="表示年度"]')).toBeNull()
    expect(host.querySelector('a[href="/manage/years"]')).toBeNull()
    expect(host.querySelector('a[href="/manage/roles"]')).not.toBeNull()
    expect(host.querySelector('a[href="/manage/tags"]')).not.toBeNull()
    const menu = host.querySelector<HTMLButtonElement>(
      'button[aria-label="管理メニューを開く"]'
    )
    if (!menu) throw new Error("Missing mobile navigation")
    expect(menu.closest("header")).not.toBeNull()
    await act(async () => menu.click())
    expect(
      document.querySelector('[role="dialog"] nav[aria-label="管理メニュー"]')
    ).not.toBeNull()
    expect(
      document.querySelector('[role="dialog"] [aria-label="表示年度"]')
    ).toBeNull()
    expect(host.querySelectorAll("header")).toHaveLength(1)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
