import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { RoleEditor } from "./role-editor"

vi.mock("@/features/management/components/header-actions", () => ({
  ManagementHeaderActions: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
}))

it("keeps the header action associated with the role form and disabled without edit permission", () => {
  const props = {
    year: 2026,
    role: null,
    canEdit: false,
    grantable: [],
    onDirtyChange: () => {},
    onClose: () => {},
  }
  const html = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <RoleEditor {...props} />
    </QueryClientProvider>
  )
  const formId = /<form id="([^"]+)"/.exec(html)?.[1]
  const header = html.slice(html.indexOf("<header>"), html.indexOf("</header>"))
  expect(formId).toBeTruthy()
  expect(header).toContain(`form="${formId}"`)
  expect(header).toContain('type="submit"')
  expect(header).toContain('disabled=""')
  expect(html.match(/type="submit"/g)).toHaveLength(1)
  expect(html).toContain('required=""')
})
