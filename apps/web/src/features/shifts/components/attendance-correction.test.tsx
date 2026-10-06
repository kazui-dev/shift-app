import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import { AttendanceCorrection } from "./attendance-correction"

vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({ children }: { children: ReactNode }) => children,
}))

it("renders 記録 as a native form submit button so clicking it confirms attendance", () => {
  const html = renderToStaticMarkup(
    <AttendanceCorrection
      assignment={{
        id: "assignment",
        own: false,
        memberId: "member",
        memberDisplayName: "佐藤 葵",
        startsAt: "2026-10-28T23:00:00.000Z",
        endsAt: "2026-10-29T01:00:00.000Z",
        active: true,
        attendance: {
          state: "present",
          expectedAt: null,
          reason: "",
          checkedInAt: "2026-10-28T23:02:00.000Z",
          checkInStatus: "pending",
          resolvedAt: null,
          updatedAt: "2026-10-28T23:02:00.000Z",
        },
      }}
      pending={false}
      onSubmit={vi.fn<(at: string, reason: string) => void>()}
      onCancel={vi.fn<() => void>()}
    />
  )
  const form = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/)?.[0]
  expect(form).toMatch(/<button\b(?=[^>]*type="submit")[^>]*>記録<\/button>/)
})
