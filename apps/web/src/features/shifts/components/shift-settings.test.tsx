import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import { makeEditors } from "../../../../dev/fixtures"
import { planOf } from "./use-shift-plan"
import { ShiftSettings } from "./shift-settings"

vi.mock("@/features/management/components/header-actions", () => ({
  ManagementHeaderActions: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
}))

it("associates the header save with the settings form and preserves validation", () => {
  const source = makeEditors()[0]
  if (!source) throw new Error("Missing fixture")
  const data = source
  const plan = planOf(data)
  function render(invalid = false) {
    return renderToStaticMarkup(
      <ShiftSettings
        data={data}
        value={invalid ? { ...plan, endsAt: plan.startsAt } : plan}
        dirty
        pending={false}
        onChange={() => {}}
        onSubmit={() => {}}
      />
    )
  }
  const html = render()
  const formId = /<form id="([^"]+)"/.exec(html)?.[1]
  expect(formId).toBeTruthy()
  const header = html.slice(0, html.indexOf("</header>"))
  expect(header).toContain('type="submit"')
  expect(header).toContain(`form="${formId}"`)
  expect(header).not.toContain('disabled=""')
  expect(html.match(/type="submit"/g)).toHaveLength(1)
  expect(html).toContain('required=""')
  expect(render(true).split("</header>")[0]).toContain('disabled=""')
})
