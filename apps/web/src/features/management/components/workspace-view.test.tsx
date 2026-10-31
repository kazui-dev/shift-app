// @vitest-environment jsdom
import { act, type ComponentProps } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { ManagementProvider } from "./provider"
import { ManagementViewport } from "./viewport"
import { ViewPreferencesProvider } from "@/app/view-preferences-provider"

vi.mock("@/features/management/use-management-year", () => ({
  useManagementYearState: () => ({ year: 2026 }),
}))

function Screen({
  mode,
  revision,
}: {
  mode: "list" | "overview"
  revision: number
}) {
  return (
    <ManagementViewport viewKey={`2026:${mode}`}>
      <p>{revision}</p>
    </ManagementViewport>
  )
}

it("restores each view independently without resetting on rerender or persisting scroll", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  localStorage.clear()
  const host = document.createElement("div")
  document.body.append(host)
  let root = createRoot(host)
  const render = async (
    mode: ComponentProps<typeof Screen>["mode"],
    revision = 0
  ) => {
    await act(async () =>
      root.render(
        <ViewPreferencesProvider user="navigation-test">
          <ManagementProvider>
            <Screen mode={mode} revision={revision} />
          </ManagementProvider>
        </ViewPreferencesProvider>
      )
    )
  }
  const viewport = () => {
    const node = host.querySelector<HTMLDivElement>(
      '[data-slot="management-viewport"]'
    )
    if (!node) throw new Error("Missing viewport")
    return node
  }
  const scroll = async (value: number) => {
    await act(async () => {
      viewport().scrollTop = value
      viewport().dispatchEvent(new Event("scroll"))
    })
  }
  const writes = vi.spyOn(Storage.prototype, "setItem")
  try {
    await render("list")
    const count = writes.mock.calls.length
    await scroll(180)
    await render("list", 1)
    expect(viewport().scrollTop).toBe(180)
    expect(writes).toHaveBeenCalledTimes(count)
    await render("overview")
    expect(viewport().scrollTop).toBe(0)
    await scroll(720)
    await render("list")
    expect(viewport().scrollTop).toBe(180)
    await render("overview")
    expect(viewport().scrollTop).toBe(720)
    await act(async () => root.unmount())
    root = createRoot(host)
    await render("overview")
    expect(viewport().scrollTop).toBe(0)
  } finally {
    await act(async () => root.unmount())
    writes.mockRestore()
    host.remove()
    vi.unstubAllGlobals()
  }
})
