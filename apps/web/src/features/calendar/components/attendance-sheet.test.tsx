// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { AttendanceSheet } from "./attendance-sheet"
import { submitAttendance } from "@/features/shifts/api/assignments"

vi.mock("@/features/shifts/api/assignments", () => ({
  submitAttendance: vi.fn<typeof submitAttendance>(async () => ({
    attendance: null,
  })),
  withdrawAttendance:
    vi.fn<
      typeof import("@/features/shifts/api/assignments").withdrawAttendance
    >(),
}))
vi.mock("@/lib/hooks/use-media-query", () => ({ useMediaQuery: () => true }))
vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => children,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))
vi.mock("@workspace/ui/lib/toast", () => ({
  toast: { success: vi.fn<() => void>(), error: vi.fn<() => void>() },
}))

it.each(["late", "absent"] as const)(
  "requires text for %s, retains withdrawal, and sends trimmed text",
  async (state) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.mocked(submitAttendance).mockClear()
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      host = document.createElement("div"),
      root = createRoot(host)
    document.body.append(host)
    const close = vi.fn<() => void>()
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <AttendanceSheet
              open
              members={[]}
              assignment={{
                id: "a",
                activityId: "s",
                roomId: null,
                memberId: "m",
                memberDisplayName: "メンバー",
                activityName: "受付",
                place: "入口",
                activityType: "勤務",
                color: "#64748B",
                notes: null,
                startsAt: "2026-11-01T01:00:00Z",
                endsAt: "2026-11-01T02:00:00Z",
                attendance: {
                  state,
                  reason: "",
                  expectedAt: null,
                  checkedInAt: null,
                  checkInStatus: null,
                  resolvedAt: null,
                  updatedAt: "2026-10-28T00:00:00Z",
                },
              }}
              now={Date.parse("2026-10-28T00:00:00Z")}
              offline={false}
              checkingIn={false}
              onCheckIn={vi.fn<() => void>()}
              onClose={close}
              onClosed={vi.fn<() => void>()}
            />
          </QueryClientProvider>
        )
      )
      const button = (text: string) => {
        const found = [...host.querySelectorAll("button")].find(
          (el) => el.textContent === text
        )
        if (!found) throw new Error(text)
        return found
      }
      const input = host.querySelector("#attendance-reason")
      if (!(input instanceof HTMLTextAreaElement)) throw new Error("reason")
      expect(input.required).toBe(true)
      expect(button("送信").disabled).toBe(true)
      expect(button("取り消し").disabled).toBe(false)
      const type = async (value: string) => {
        await act(async () => {
          const descriptor = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value"
          )
          descriptor?.set?.call(input, value)
          input.dispatchEvent(new Event("input", { bubbles: true }))
        })
      }
      await type(" 　\n ")
      expect(button("送信").disabled).toBe(true)
      await type(" 電車遅延 ")
      expect(button("送信").disabled).toBe(false)
      await act(async () =>
        host
          .querySelector<HTMLButtonElement>(
            "button[aria-label='シフトメンバー']"
          )
          ?.click()
      )
      expect(host.textContent).toContain("時間が重なるメンバーはいません。")
      expect(submitAttendance).not.toHaveBeenCalled()
      await act(async () =>
        host
          .querySelector<HTMLButtonElement>("button[aria-label='勤怠に戻る']")
          ?.click()
      )
      expect(input.value).toBe(" 電車遅延 ")
      await act(async () => button("送信").click())
      expect(submitAttendance).toHaveBeenCalledWith(
        "a",
        state === "late"
          ? { state, expectedAt: null, reason: "電車遅延" }
          : { state, reason: "電車遅延" }
      )
      expect(close).toHaveBeenCalledOnce()
    } finally {
      await act(async () => root.unmount())
      client.clear()
      host.remove()
      vi.unstubAllGlobals()
    }
  }
)
