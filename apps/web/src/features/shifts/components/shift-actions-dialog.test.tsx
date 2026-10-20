import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import { ShiftActionsDialog } from "./shift-actions-dialog"
vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}))
it("submits duplication and exposes the target start/end times", () => {
  const html = renderToStaticMarkup(
    <ShiftActionsDialog
      startsAt="2026-11-01T00:00:00Z"
      endsAt="2026-11-01T09:00:00Z"
      dirty={false}
      pending={false}
      active
      onClose={() => {}}
      onSettings={() => {}}
      onAttendance={() => {}}
      onNotify={() => {}}
      onCopy={() => {}}
      onDelete={() => {}}
    />
  )
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*>複製<\/button>/)
  expect(html).toContain('aria-label="複製先の開始"')
  expect(html).toContain('aria-label="複製先の終了"')
})
