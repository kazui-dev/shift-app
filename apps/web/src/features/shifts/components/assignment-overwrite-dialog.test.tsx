// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import type { ReactNode } from "react"
import type { AssignmentOverwriteReview } from "@workspace/shared/shifts"
import { AssignmentOverwriteDialog } from "./assignment-overwrite-dialog"

vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({
    children,
    title,
  }: {
    children: ReactNode
    title: string
  }) => (
    <dialog open aria-label={title}>
      {children}
    </dialog>
  ),
}))
it("shows overlap first and full times for both assignments, cancels without saving, and disables protected or pending overwrites", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div"),
    root = createRoot(host)
  document.body.append(host)
  const cancel = vi.fn<() => void>(),
    confirm = vi.fn<() => void>()
  const review: AssignmentOverwriteReview = {
    token: "a".repeat(64),
    changes: [
      {
        assignmentId: "a",
        activityId: "b",
        activityName: "受付",
        memberId: "m",
        memberName: "佐藤 葵",
        startsAt: "2026-11-01T00:00:00.000Z",
        endsAt: "2026-11-01T03:00:00.000Z",
        remaining: [
          {
            startsAt: "2026-11-01T00:00:00.000Z",
            endsAt: "2026-11-01T01:00:00.000Z",
          },
          {
            startsAt: "2026-11-01T02:00:00.000Z",
            endsAt: "2026-11-01T03:00:00.000Z",
          },
        ],
        blockedReason: null,
      },
    ],
  }
  const render = async (pending = false) =>
    act(async () =>
      root.render(
        <AssignmentOverwriteDialog
          review={review}
          plan={{
            name: "会場案内",
            place: "",
            activityType: "shift",
            startsAt: "2026-11-01T00:00:00.000Z",
            endsAt: "2026-11-01T09:00:00.000Z",
            color: "#000000",
            notes: null,
            active: true,
            version: 1,
            candidateRoleIds: [],
            responsibles: [],
            requirements: [],
            slots: [
              {
                id: "new",
                startsAt: "2026-11-01T01:00:00.000Z",
                endsAt: "2026-11-01T05:00:00.000Z",
                capacity: null,
                memberIds: ["m"],
              },
            ],
          }}
          pending={pending}
          onCancel={cancel}
          onConfirm={confirm}
        />
      )
    )
  const button = (text: string) => {
    const element = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === text
    )
    if (!element) throw new Error(text)
    return element
  }
  try {
    await render()
    expect(host.textContent).toContain("重複時間")
    expect(host.textContent?.indexOf("重複時間")).toBeLessThan(
      host.textContent?.indexOf("上書きされる勤務") ?? 0
    )
    expect(host.textContent).toContain("09:00–12:00")
    expect(host.textContent).toContain("上書きされる勤務")
    expect(host.textContent).toContain("追加される勤務")
    expect(host.textContent).toContain("10:00–14:00")
    expect(host.textContent).toContain("10:00–11:00")
    expect(host.textContent).not.toContain("09:00–10:00")
    expect(host.textContent).not.toContain("11:00–12:00")
    expect(host.textContent).not.toContain("残る")
    await act(async () => button("キャンセル").click())
    expect(cancel).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    await act(async () => button("上書き保存").click())
    expect(confirm).toHaveBeenCalledOnce()
    review.changes = review.changes.map((change) => ({
      ...change,
      remaining: [],
      blockedReason: "このシフトを変更する権限がありません。",
    }))
    await render()
    expect(host.textContent).toContain("09:00–12:00")
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("権限")
    expect(button("上書き保存").disabled).toBe(true)
    await act(async () => button("上書き保存").click())
    expect(confirm).toHaveBeenCalledOnce()
    await render(true)
    expect(button("キャンセル").disabled).toBe(true)
    expect(button("上書き保存中…").disabled).toBe(true)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
