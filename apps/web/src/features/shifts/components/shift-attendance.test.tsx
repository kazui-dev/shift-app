// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { keys } from "@/app/data/keys"
import type { AttendanceData } from "./attendance-data"
import { ShiftAttendance } from "./shift-attendance"

vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({
    children,
    headerActions,
  }: {
    children: ReactNode
    headerActions: ReactNode
  }) => (
    <>
      {headerActions}
      {children}
    </>
  ),
}))

it("combines attendance selections with OR, clears all, and separates pending check-ins without inclusion controls", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const assignment = (
    name: string,
    attendance: AttendanceData["assignments"][number]["attendance"],
    active = true
  ) => ({
    id: name,
    memberId: name,
    memberDisplayName: name,
    own: false,
    active,
    startsAt: "2026-10-29T00:00:00Z",
    endsAt: "2026-10-29T03:00:00Z",
    attendance,
  })
  const record = (state: "late" | "absent" | "present", pending = false) => ({
    state,
    expectedAt: null,
    reason: "確認用の理由",
    checkedInAt: null,
    checkInStatus: pending ? ("pending" as const) : ("confirmed" as const),
    resolvedAt: null,
    updatedAt: "2026-10-29T00:00:00Z",
  })
  client.setQueryData<AttendanceData>(keys.shiftAttendance("test"), {
    canManage: false,
    assignments: [
      assignment("遅刻の人", record("late")),
      assignment("欠勤の人", record("absent"), false),
      assignment("出勤の人", record("present")),
      assignment("確認待ちの人", record("present", true)),
      assignment("未記録の人", null),
      assignment("解除済みの人", null, false),
    ],
  })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  const click = async (selector: string, text?: string) => {
    const element = [...document.querySelectorAll(selector)].find(
      (e) => text === undefined || e.textContent === text
    )
    if (!(element instanceof HTMLElement))
      throw new Error(`Missing ${selector} ${text}`)
    await act(async () => element.click())
  }
  const names = () =>
    [...host.querySelectorAll("li > div > p:first-child")].map(
      (e) => e.textContent
    )
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <ShiftAttendance activityId="test" onClose={() => {}} />
        </QueryClientProvider>
      )
    )
    expect(names()).toHaveLength(5)
    await click('button[aria-label="勤怠で絞り込み"]')
    expect(document.body.textContent).not.toContain("含まない")
    expect(document.querySelector('[aria-label="勤怠の一致条件"]')).toBeNull()
    await click('[role="option"]', "遅刻")
    await click('[role="option"]', "欠勤")
    expect(names()).toEqual(["遅刻の人", "欠勤の人"])
    await click("button", "全解除")
    expect(names()).toHaveLength(5)
    await click('[role="option"]', "出勤済み")
    expect(names()).toEqual(["出勤の人"])
    await click('[role="option"]', "出勤確認待ち")
    expect(names()).toEqual(["出勤の人", "確認待ちの人"])
    await click("button", "全解除")
    await click('[role="option"]', "出勤記録なし")
    expect(names()).toEqual(["未記録の人"])
  } finally {
    await act(async () => root.unmount())
    client.clear()
    host.remove()
    vi.unstubAllGlobals()
  }
})
