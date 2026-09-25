import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import { ManagementProvider } from "./provider"
import { useShiftView } from "./context"

vi.mock("@/components/use-management-year", () => ({
  useManagementYearState: () => ({ year: 2026 }),
}))

function Remember({ year }: { year: number }) {
  const view = useShiftView(year)
  view.filters = { search: "鈴木", role: "all", includeUnavailable: false }
  view.scrollTop = 760
  return null
}

function Read({ year }: { year: number }) {
  const view = useShiftView(year)
  return <output>{`${view.filters?.search ?? ""}:${view.scrollTop}`}</output>
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
