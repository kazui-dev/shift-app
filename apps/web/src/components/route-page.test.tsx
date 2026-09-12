import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { RoutePage } from "./route-page"

type Navigation = { current: { pathname: string }; next: { pathname: string } }
const boundary = vi.hoisted(() => {
  const state: {
    status: "idle" | "blocked"
    guard?: (navigation: Navigation) => boolean
    completed?: () => void
    open?: boolean
  } = { status: "idle" }
  return { state, proceed: vi.fn<() => void>(), reset: vi.fn<() => void>() }
})
vi.mock("@tanstack/react-router", () => ({
  useMatch: () => "/manage/shifts/availability",
  useBlocker: (options: { shouldBlockFn: (value: Navigation) => boolean }) => {
    boundary.state.guard = options.shouldBlockFn
    return {
      status: boundary.state.status,
      proceed: boundary.proceed,
      reset: boundary.reset,
    }
  },
}))
vi.mock("@workspace/ui/components/responsive-page", () => ({
  ResponsivePage: ({
    open,
    onClosed,
    children,
  }: {
    open: boolean
    onClosed: () => void
    children: ReactNode
  }) => {
    boundary.state.open = open
    boundary.state.completed = onClosed
    return <section>{children}</section>
  },
}))
vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({ title }: { title: string }) => <aside>{title}</aside>,
}))

beforeEach(() => {
  boundary.state.status = "idle"
  vi.clearAllMocks()
})

describe("route page navigation", () => {
  it("keeps the form mounted and waits for the closing animation before leaving", () => {
    boundary.state.status = "blocked"
    const html = renderToStaticMarkup(
      <RoutePage onClose={() => {}}>入力途中のフォーム</RoutePage>
    )
    expect(html).toContain("入力途中のフォーム")
    expect(boundary.state.open).toBe(false)
    expect(boundary.proceed).not.toHaveBeenCalled()
    boundary.state.completed?.()
    expect(boundary.proceed).toHaveBeenCalledOnce()
  })

  it("keeps an unsaved form open while asking whether to discard changes", () => {
    boundary.state.status = "blocked"
    const html = renderToStaticMarkup(
      <RoutePage dirty onClose={() => {}}>
        未保存のシフト
      </RoutePage>
    )
    expect(boundary.state.open).toBe(true)
    expect(html).toContain("未保存のシフト")
    expect(html).toContain("変更を破棄しますか")
    expect(boundary.proceed).not.toHaveBeenCalled()
  })

  it("leaves parent pages open for child routes and lets the child handle its own exit", () => {
    renderToStaticMarkup(<RoutePage onClose={() => {}}>日程一覧</RoutePage>)
    const guard = boundary.state.guard
    expect(
      guard?.({
        current: { pathname: "/manage/shifts/availability" },
        next: { pathname: "/manage" },
      })
    ).toBe(true)
    expect(
      guard?.({
        current: { pathname: "/manage/shifts/availability" },
        next: { pathname: "/manage/shifts/availability/new" },
      })
    ).toBe(false)
    expect(
      guard?.({
        current: { pathname: "/manage/shifts/availability/new" },
        next: { pathname: "/manage/shifts/availability" },
      })
    ).toBe(false)
    expect(
      guard?.({
        current: { pathname: "/manage/shifts/availability" },
        next: { pathname: "/manage/shifts/availability" },
      })
    ).toBe(false)
  })

  it("supports a route page rendered by its persistent parent, such as new chat", () => {
    renderToStaticMarkup(
      <RoutePage path="/chat/new" onClose={() => {}}>
        新しいチャット
      </RoutePage>
    )
    expect(
      boundary.state.guard?.({
        current: { pathname: "/chat/new" },
        next: { pathname: "/chat" },
      })
    ).toBe(true)
  })
})
