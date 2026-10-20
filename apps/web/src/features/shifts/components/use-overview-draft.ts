import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { keys } from "@/app/data/keys"
import { saveOverviewDrafts } from "./save-overview-drafts"
import { change, redo, undo, type EditHistory } from "./editor-history"
import type { OverviewDrafts, OverviewDraft } from "./overview-draft"

export function useOverviewDraft() {
  const client = useQueryClient()
  const [history, setHistory] = useState<EditHistory<OverviewDrafts>>({
    past: [],
    present: {},
    future: [],
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function save() {
    if (pending) return
    setPending(true)
    setError("")
    const { remaining, failures, confirmed } = await saveOverviewDrafts(
      history.present
    )
    for (const { id, saved } of confirmed)
      client.setQueryData(keys.activityEditor(id), saved)
    // Successful work is removed so retry cannot submit it a second time.
    setHistory({ past: [], present: remaining, future: [] })
    setError(failures.join("\n"))
    await Promise.allSettled(
      [
        keys.shiftOverview(),
        keys.activities(),
        keys.assignments(),
        keys.chatRooms(),
        ...confirmed.map(({ id }) => keys.shiftAttendance(id)),
      ].map((queryKey) => client.invalidateQueries({ queryKey }))
    )
    setPending(false)
  }
  return {
    drafts: history.present,
    pending,
    error,
    dirty: Object.keys(history.present).length > 0,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => setHistory((current) => undo(current)),
    redo: () => setHistory((current) => redo(current)),
    update: (id: string, draft: OverviewDraft) =>
      setHistory((current) => {
        const next = { ...current.present }
        const base = current.present[id]?.base ?? draft.base
        if (JSON.stringify(base) === JSON.stringify(draft.plan)) delete next[id]
        else next[id] = { base, plan: draft.plan }
        return change(current, next)
      }),
    save,
  }
}
