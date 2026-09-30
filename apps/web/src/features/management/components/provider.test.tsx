import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import { ManagementProvider } from "./provider"
import { useShiftView } from "@/features/shifts/shift-view-context"
import { useManagementScreenView } from "../management-context"

vi.mock("@/features/management/use-management-year", () => ({
  useManagementYearState: () => ({ year: 2026 }),
}))

function Remember({ year }: { year: number }) {
  const view = useShiftView(year)
  view.save({
    filters: { search: "鈴木", role: "all", includeUnavailable: false },
    scrollTop: 760,
  })
  return null
}

function Read({ year }: { year: number }) {
  const view = useShiftView(year)
  return <output>{`${view.filters?.search ?? ""}:${view.scrollTop}`}</output>
}

function RememberScreen({ viewKey }: { viewKey: string }) {
  const view = useManagementScreenView(viewKey)
  view.save({ search: "田中", scrollTop: 420 })
  return null
}

function ReadScreen({ viewKey }: { viewKey: string }) {
  const view = useManagementScreenView(viewKey)
  return <output>{`${view.search}:${view.scrollTop}`}</output>
}

function RememberShiftList({ year }: { year: number }) {
  const view = useManagementScreenView(`shifts:${year}`)
  view.save({ search: "受付", filter: "active", scrollTop: 560 })
  return null
}

function ReadShiftList({ year }: { year: number }) {
  const view = useManagementScreenView(`shifts:${year}`)
  return (
    <output>{`${view.search}:${view.filter || "all"}:${view.scrollTop}`}</output>
  )
}

it("shares shift search and scroll within a management year, keeping other years separate", () => {
  const html = renderToStaticMarkup(
    <ManagementProvider>
      <Remember year={2026} />
      <Read year={2026} />
      <Read year={2027} />
    </ManagementProvider>
  )
  expect(html).toBe("<output>鈴木:760</output><output>:0</output>")
})

it("does not leak shift search and scroll into a new management session", () => {
  renderToStaticMarkup(
    <ManagementProvider>
      <Remember year={2026} />
    </ManagementProvider>
  )
  expect(
    renderToStaticMarkup(
      <ManagementProvider>
        <Read year={2026} />
      </ManagementProvider>
    )
  ).toBe("<output>:0</output>")
})

it("keeps management search and scroll by screen and year within a session", () => {
  const html = renderToStaticMarkup(
    <ManagementProvider>
      <RememberScreen viewKey="members:2026" />
      <ReadScreen viewKey="members:2026" />
      <ReadScreen viewKey="members:2027" />
      <ReadScreen viewKey="users" />
    </ManagementProvider>
  )
  expect(html).toBe(
    "<output>田中:420</output><output>:0</output><output>:0</output>"
  )
})

it("keeps shift list filters and position for the selected year", () => {
  const html = renderToStaticMarkup(
    <ManagementProvider>
      <RememberShiftList year={2026} />
      <ReadShiftList year={2026} />
      <ReadShiftList year={2027} />
    </ManagementProvider>
  )
  expect(html).toBe("<output>受付:active:560</output><output>:all:0</output>")
})
