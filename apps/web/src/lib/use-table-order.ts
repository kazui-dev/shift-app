import { useEffect, useRef, useState } from "react"
import { reorderVisibleRows } from "@workspace/ui/lib/reorder"
import { toast } from "@workspace/ui/lib/toast"
import { errorMessage } from "./http/client"

export function useTableOrder<T extends { id: string }>({
  data,
  editable,
  getLatest,
  persist,
  refresh,
  conflictMessage,
  onStatusChange,
}: {
  data: T[]
  editable: (row: T) => boolean
  getLatest: () => Promise<T[]>
  persist: (ids: string[]) => Promise<void>
  refresh: () => Promise<void>
  conflictMessage: string
  onStatusChange?:
    | ((status: { dirty: boolean; pending: boolean }) => void)
    | undefined
}) {
  const [pending, setPending] = useState(false)
  const saving = useRef(false)
  const [dragItems, setDragItems] = useState<T[] | null>(null)
  const [draft, setDraft] = useState<{ base: T[]; items: T[] } | null>(null)
  const items = draft?.items ?? dragItems ?? data
  useEffect(() => {
    onStatusChange?.({ dirty: draft !== null, pending })
    return () => onStatusChange?.({ dirty: false, pending: false })
  }, [draft, pending, onStatusChange])
  function move(visibleIds: string[], from: string, to: string) {
    if (saving.current) return
    const ids = reorderVisibleRows(items, visibleIds, from, to, editable)
    if (!ids) return
    const byId = new Map(items.map((item) => [item.id, item]))
    const next = ids.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
    const base = draft?.base ?? items
    setDraft(
      base.every((item, index) => item.id === ids[index])
        ? null
        : { base, items: next }
    )
  }
  async function save() {
    if (!draft || saving.current) return
    saving.current = true
    setPending(true)
    try {
      const latest = await getLatest()
      if (
        latest.length !== draft.base.length ||
        latest.some((item, index) => item.id !== draft.base[index]?.id)
      ) {
        toast.error(conflictMessage)
        return
      }
      await persist(draft.items.map((item) => item.id))
      await refresh()
      setDraft(null)
      toast.success("並び順を保存しました。")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
      saving.current = false
    }
  }
  return {
    items,
    pending,
    dirty: draft !== null,
    move,
    save,
    cancel: () => {
      if (!saving.current) setDraft(null)
    },
    setDragging: (dragging: boolean) => setDragItems(dragging ? items : null),
  }
}
