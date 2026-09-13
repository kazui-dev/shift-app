import { useEffect, useState } from "react"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { change, redo, undo, type EditHistory } from "./editor-history"
import { mergePlan } from "./merge-plan"
import type { EditorData } from "./time-grid"

export function planOf(data: EditorData): ActivityEditorInput {
  return {
    ...data.activity,
    slots: data.slots,
    candidateRoleIds: data.candidateRoleIds,
    responsibles: data.responsibles,
  }
}

/**
 * The plan being edited, its undo history, and what the server last confirmed,
 * so a rejected save can keep local edits and replay them onto the new base.
 */
export function useShiftPlan(source: EditorData, pending: boolean) {
  const [history, setHistory] = useState<EditHistory<ActivityEditorInput>>(
    () => ({ past: [], present: planOf(source), future: [] })
  )
  const [saved, setSaved] = useState(() => JSON.stringify(planOf(source)))
  const [base, setBase] = useState(() => planOf(source))
  const [version, setVersion] = useState(source.activity.version)
  const plan = history.present
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        pending ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "z"
      )
        return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.closest("input,textarea,select") || target.isContentEditable)
      )
        return
      event.preventDefault()
      setHistory((current) => (event.shiftKey ? redo(current) : undo(current)))
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [pending])
  return {
    plan,
    base,
    version,
    dirty: JSON.stringify(plan) !== saved,
    update: (value: ActivityEditorInput) =>
      setHistory((current) => change(current, value)),
    /** Accepts the server's answer as the new base for further edits. */
    confirm: (next: ActivityEditorInput, nextVersion: number) => {
      setSaved(JSON.stringify(next))
      setBase({ ...next, version: nextVersion })
      setVersion(nextVersion)
    },
    /** Replays the undo history onto a newer server plan after a conflict. */
    rebase: (latest: EditorData, merged: ActivityEditorInput) => {
      const target = planOf(latest)
      setVersion(latest.activity.version)
      setBase(target)
      setSaved(JSON.stringify(target))
      setHistory((current) => ({
        past: current.past.map((item) => mergePlan(base, item, target).plan),
        present: merged,
        future: current.future.map(
          (item) => mergePlan(base, item, target).plan
        ),
      }))
    },
  }
}
