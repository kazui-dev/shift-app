import type { ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import { SelectContent } from "@workspace/ui/components/select"
import { SelectField } from "./select-field"

vi.mock("@workspace/ui/components/select", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@workspace/ui/components/select")>()
  return {
    ...original,
    SelectContent: vi.fn<
      (props: ComponentProps<typeof original.SelectContent>) => null
    >(() => null),
  }
})

it("allows the default portal before a native dialog container is found", () => {
  renderToStaticMarkup(
    <SelectField
      value="member"
      options={[{ value: "member", label: "一般" }]}
      onValueChange={() => {}}
    />
  )
  // Base UI intentionally renders nothing for an explicitly null container.
  expect(vi.mocked(SelectContent).mock.calls[0]?.[0].container).toBeUndefined()
})
