import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vite-plus/test"
import { AssignmentSelectionToolbar } from "./assignment-selection"

it("shows batch actions only after target selection and permits assigning an empty member row", () => {
  const emptyKeys: string[] = []
  const selection = {
    active: false,
    available: ["member:empty", "assigned"],
    revision: 0,
    keys: emptyKeys,
    replace: vi.fn<(keys: string[]) => void>(),
    end: vi.fn<() => void>(),
    toggle: vi.fn<(key: string) => void>(),
  }
  const details = [
    { key: "assigned", name: "対象者", activity: "受付", time: "09:00〜10:00" },
  ]
  function render(active: boolean, keys: string[]) {
    return renderToStaticMarkup(
      <AssignmentSelectionToolbar
        selection={{ ...selection, active, keys }}
        details={details}
        pending={false}
        onAssign={vi.fn<() => void>()}
        onRemove={vi.fn<() => void>()}
      />
    )
  }
  expect(render(false, [])).toBe("")
  const emptyMember = render(true, ["member:empty"])
  expect(emptyMember).toContain("一括割当")
  expect(emptyMember).toMatch(/<button[^>]* disabled=""[^>]*>割当解除/)
  const assigned = render(true, ["assigned"])
  expect(assigned).toContain("一括割当")
  expect(assigned).toContain("割当解除")
  expect(assigned).not.toContain(' disabled=""')
})
