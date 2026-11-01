// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vite-plus/test"
import { keys } from "@/app/data/keys"
import { makeEditors } from "../../../../dev/fixtures"
import { AssignmentPanel } from "./assignment-panel"
import type { OverviewDrafts } from "./overview-draft"
import { planOf } from "./use-shift-plan"

vi.mock("./shift-popover", () => ({
  ShiftPopover: ({ children }: { children: ReactNode }) => (
    <dialog open>{children}</dialog>
  ),
}))

it.each([false, true])(
  "closes the removed assignment's panel instead of retaining a detached anchor (other shift: %s)",
  async (otherShift) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    const sources = makeEditors()
    const source = sources[0]
    const target = sources[otherShift ? 1 : 0]
    const slot = target?.slots[0]
    const memberId = slot?.memberIds[0]
    if (!source || !target || !slot || !memberId)
      throw new Error("Missing fixture")
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(keys.activityEditor(target.activity.id), target)
    client.setQueryData(keys.activities(source.activity.year), {
      activities: sources.map((item) => item.activity),
    })
    const applied = vi.fn<(updates: OverviewDrafts) => void>()
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    const View = () => {
      const [open, setOpen] = useState(true)
      const [drafts, setDrafts] = useState<OverviewDrafts>({})
      return (
        <QueryClientProvider client={client}>
          {open && (
            <AssignmentPanel
              source={source}
              activityId={target.activity.id}
              selection={{
                slotId: slot.id,
                memberId,
                startsAt: slot.startsAt,
                endsAt: slot.endsAt,
              }}
              anchor={{ position: host, focus: host }}
              drafts={drafts}
              pending={false}
              onApply={(updates) => {
                applied(updates)
                setDrafts(updates)
              }}
              onClose={() => setOpen(false)}
            />
          )}
        </QueryClientProvider>
      )
    }
    try {
      await act(async () => root.render(<View />))
      const remove = Array.from(host.querySelectorAll("button")).find(
        (button) => button.textContent === "割当を外す"
      )
      if (!remove) throw new Error("Missing remove action")
      await act(async () => remove.click())
      expect(host.querySelector("dialog")).toBeNull()
      expect(applied).toHaveBeenCalledTimes(1)
      const update = applied.mock.calls[0]?.[0][target.activity.id]
      expect(
        update?.plan.slots.find((item) => item.id === slot.id)?.memberIds
      ).not.toContain(memberId)
      expect(update?.base).toEqual(planOf(target))
      expect(update?.atomic).toBe(otherShift)
    } finally {
      await act(async () => root.unmount())
      client.clear()
      host.remove()
      vi.unstubAllGlobals()
    }
  }
)
