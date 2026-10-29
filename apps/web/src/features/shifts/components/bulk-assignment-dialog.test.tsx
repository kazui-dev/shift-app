// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vite-plus/test"
import { makeEditors, uuid } from "../../../../dev/fixtures"
import { planOf } from "./use-shift-plan"
import { BulkAssignmentDialog } from "./bulk-assignment-dialog"

vi.mock("@/components/responsive-overlay", () => ({
  ResponsiveDialog: ({
    children,
    title,
  }: {
    children: ReactNode
    title: string
  }) => (
    <dialog open aria-label={title}>
      {children}
    </dialog>
  ),
}))
it("keeps overlapping people selected and applies all of them for the shared save confirmation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div"),
    root = createRoot(host)
  document.body.append(host)
  const data = makeEditors()[0]
  if (!data) throw new Error("fixture")
  data.members = data.members.slice(0, 2)
  data.otherAssignments = data.members.map((member) => ({
    memberId: member.id,
    startsAt: data.activity.startsAt,
    endsAt: data.activity.endsAt,
    name: "会場案内",
  }))
  const plan = { ...planOf(data), slots: [] }
  const apply = vi.fn<Parameters<typeof BulkAssignmentDialog>[0]["onApply"]>(),
    close = vi.fn<() => void>()
  const button = (label: string) => {
    const element = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === label
    )
    if (!element) throw new Error(label)
    return element
  }
  try {
    await act(async () =>
      root.render(
        <BulkAssignmentDialog
          data={data}
          plan={plan}
          memberIds={[uuid(1), uuid(2)]}
          onApply={apply}
          onClose={close}
        />
      )
    )
    await act(async () => button("確認").click())
    const boxes = [...host.querySelectorAll('input[type="checkbox"]')]
    expect(boxes).toHaveLength(2)
    expect(
      boxes.every(
        (input) =>
          input instanceof HTMLInputElement && input.checked && !input.disabled
      )
    ).toBe(true)
    expect(host.textContent).toContain("勤務重複")
    expect(host.textContent).not.toContain("勤務が重なる人")
    await act(async () => button("2人に適用").click())
    expect(apply).toHaveBeenCalledOnce()
    expect(apply.mock.calls[0]?.[0].slots[0]?.memberIds).toEqual([
      uuid(1),
      uuid(2),
    ])
    expect(apply.mock.calls[0]?.[1]).toHaveLength(2)
    expect(close).toHaveBeenCalledOnce()
    expect(plan.slots).toEqual([])
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})
