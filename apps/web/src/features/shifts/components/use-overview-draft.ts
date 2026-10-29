import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { errorMessage } from "@/lib/http/client"
import { keys } from "@/app/data/keys"
import {
  saveOverviewDrafts,
  type OverviewOverwrite,
} from "./save-overview-drafts"
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
  const [overwrite, setOverwrite] = useState<
    (OverviewOverwrite & { pending: boolean }) | null
  >(null)
  const resolveOverwrite = useRef<((confirmed: boolean) => void) | null>(null)
  useEffect(
    () => () => {
      resolveOverwrite.current?.(false)
    },
    []
  )
  const requestOverwrite = (request: OverviewOverwrite) =>
    new Promise<boolean>((resolve) => {
      resolveOverwrite.current = resolve
      setOverwrite({ ...request, pending: false })
    })
  function answerOverwrite(confirmed: boolean) {
    if (!resolveOverwrite.current) return
    resolveOverwrite.current(confirmed)
    resolveOverwrite.current = null
    setOverwrite((current) =>
      confirmed && current ? { ...current, pending: true } : null
    )
  }
  async function save() {
    if (pending) return
    setPending(true)
    setError("")
    try {
      const { remaining, failures, confirmed } = await saveOverviewDrafts(
        history.present,
        requestOverwrite
      )
      for (const { id, saved } of confirmed)
        client.setQueryData(keys.activityEditor(id), saved)
      if (confirmed.length)
        setHistory({ past: [], present: remaining, future: [] })
      setError(failures.join("\n"))
      await Promise.allSettled(
        [
          keys.activityEditor(),
          keys.shiftOverview(),
          keys.activities(),
          keys.assignments(),
          keys.chatRooms(),
          keys.shiftAttendance(),
        ].map((queryKey) => client.invalidateQueries({ queryKey }))
      )
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setOverwrite(null)
      resolveOverwrite.current = null
      setPending(false)
    }
  }
  function updateMany(updates: OverviewDrafts) {
    setHistory((current) => {
      const next = { ...current.present }
      for (const [id, draft] of Object.entries(updates)) {
        const base = current.present[id]?.base ?? draft.base
        if (JSON.stringify(base) === JSON.stringify(draft.plan)) delete next[id]
        else next[id] = { base, plan: draft.plan }
      }
      return change(current, next)
    })
  }
  return {
    overwrite,
    confirmOverwrite: () => answerOverwrite(true),
    cancelOverwrite: () => answerOverwrite(false),
    drafts: history.present,
    pending,
    error,
    dirty: Object.keys(history.present).length > 0,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => setHistory((current) => undo(current)),
    redo: () => setHistory((current) => redo(current)),
    update: (id: string, draft: OverviewDraft) => updateMany({ [id]: draft }),
    updateMany,
    save,
  }
}
