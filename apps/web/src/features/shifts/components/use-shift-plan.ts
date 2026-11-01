import { useCallback, useEffect, useState } from "react"
import type { ActivityEditorInput } from "@workspace/shared/shifts"
import { change, redo, undo, type EditHistory } from "./editor-history"
import { mergePlan } from "./merge-plan"
import type { EditorData } from "../editor-data"
import type { OverviewDrafts } from "./overview-draft"

export function planOf(data: EditorData): ActivityEditorInput {
  return {
    ...data.activity,
    notices: data.notices ?? [],
    slots: data.slots,
    requirements: data.requirements,
    candidateRoleIds: data.candidateRoleIds,
    responsibles: data.responsibles,
  }
}

/** Revision is concurrency metadata, not an editable field. */
function signature(plan: ActivityEditorInput) {
  const { version: _version, ...content } = plan
  return JSON.stringify(content)
}
/**
 * The plan being edited, its undo history, and what the server last confirmed,
 * so a rejected save can keep local edits and replay them onto the new base.
 */
export function useShiftPlan(source: EditorData, pending: boolean) {
  const [history, setHistory] = useState<
    EditHistory<{ plan: ActivityEditorInput; related: OverviewDrafts }>
  >(() => ({
    past: [],
    present: { plan: planOf(source), related: {} },
    future: [],
  }))
  const [saved, setSaved] = useState(() => signature(planOf(source)))
  const [base, setBase] = useState(() => planOf(source))
  const [version, setVersion] = useState(source.activity.version)
  const { plan, related } = history.present
  const update = useCallback(
    (value: ActivityEditorInput) =>
      setHistory((current) =>
        change(current, { ...current.present, plan: value })
      ),
    []
  )
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
    related,
    updateMany: (updates: OverviewDrafts) =>
      setHistory((current) => {
        const next = { ...current.present.related }
        for (const [id, draft] of Object.entries(updates)) {
          if (id === source.activity.id) continue
          const original = next[id]?.base ?? draft.base
          if (signature(original) === signature(draft.plan)) delete next[id]
          else next[id] = { ...draft, base: original }
        }
        return change(current, {
          plan: updates[source.activity.id]?.plan ?? current.present.plan,
          related: next,
        })
      }),
    undo: () => setHistory((current) => undo(current)),
    redo: () => setHistory((current) => redo(current)),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    base,
    version,
    dirty: signature(plan) !== saved || Object.keys(related).length > 0,
    update,
    /** Accepts the server's answer as the new base for further edits. */
    confirm: (next: ActivityEditorInput, nextVersion: number) => {
      setSaved(signature(next))
      setBase({ ...next, version: nextVersion })
      setVersion(nextVersion)
      if (
        Object.keys(related).length ||
        plan.releasedAssignments?.length ||
        signature(next) !== signature(plan)
      )
        setHistory({
          past: [],
          present: { plan: { ...next, version: nextVersion }, related: {} },
          future: [],
        })
    },
    /** Replays the undo history onto a newer server plan after a conflict. */
    rebase: (latest: EditorData, merged: ActivityEditorInput) => {
      const target = planOf(latest)
      setVersion(latest.activity.version)
      setBase(target)
      setSaved(signature(target))
      setHistory((current) => ({
        past: current.past.map((item) => ({
          ...item,
          plan: mergePlan(base, item.plan, target).plan,
        })),
        present: { ...current.present, plan: merged },
        future: current.future.map((item) => ({
          ...item,
          plan: mergePlan(base, item.plan, target).plan,
        })),
      }))
    },
  }
}
