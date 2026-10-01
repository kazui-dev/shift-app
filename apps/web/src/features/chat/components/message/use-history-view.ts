import {
  historyWindow,
  messageOffset,
  nearestMessage,
} from "@/features/chat/components/message/history-layout"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  useVirtualizer,
  measureElement,
  type VirtualItem,
} from "@tanstack/react-virtual"
import type { MessageRow } from "@/features/chat/components/message/list"

const measurements = new Map<string, VirtualItem[]>()

/** Coordinates belong to the virtualizer; all scroll writes belong to MessageScroll. */
export function useHistoryView(roomId: string, rows: MessageRow[]) {
  const viewport = useRef<HTMLElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [padding, setPadding] = useState(16)
  const [focused, setFocused] = useState<string | null>(null)
  const revision = useRef(0)
  const indexes = useMemo(
    () => new Map(rows.map((row, index) => [row.id, index])),
    [rows]
  )
  const getItemKey = useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row) throw new Error("Missing history row")
      return row.id
    },
    [rows]
  )
  const virtualizer = useVirtualizer<HTMLElement, HTMLLIElement>({
    count: rows.length,
    getScrollElement: () => viewport.current,
    getItemKey,
    // No library scroll writes, including mount-time offset synchronization.
    scrollToFn: () => undefined,
    estimateSize: () => 80,
    // Padding above the ol is part of the same scroll coordinate system.
    scrollMargin: padding,
    initialMeasurementsCache: measurements.get(roomId) ?? [],
    overscan: 0,
    measureElement: (element, entry, instance) => {
      const size = measureElement(element, entry, instance)
      const id = element.dataset.messageId
      if (id && instance.itemSizeCache.get(id) !== size) revision.current += 1
      return size
    },
    rangeExtractor: (): number[] =>
      historyWindow(
        virtualizer,
        viewport.current?.scrollTop ?? 0,
        viewport.current?.clientHeight ?? 0,
        focused === null ? undefined : indexes.get(focused)
      ),
  })
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false
  const items = virtualizer.getVirtualItems()
  const total = virtualizer.getTotalSize()
  useLayoutEffect(() => {
    const body = content.current
    if (!body) return undefined
    const resize = new ResizeObserver(() =>
      setPadding(parseFloat(getComputedStyle(body).paddingTop))
    )
    resize.observe(body)
    return () => {
      resize.disconnect()
      measurements.delete(roomId)
      measurements.set(roomId, virtualizer.measurementsCache.slice())
      if (measurements.size > 20) {
        const oldest = measurements.keys().next().value
        if (oldest !== undefined) measurements.delete(oldest)
      }
    }
  }, [roomId, virtualizer])
  useLayoutEffect(() => {
    if (focused !== null && !indexes.has(focused)) {
      viewport.current?.focus({ preventScroll: true })
      setFocused(null)
    }
  }, [focused, indexes])
  const anchorAt = (top: number) => {
    const item = virtualizer.getVirtualItemForOffset(top)
    const row = item && rows[item.index]
    return row && item
      ? {
          id: row.id,
          offset: item.start - top,
          index: item.index,
          sequence: row.sequence,
        }
      : null
  }
  return {
    revision: revision.current,
    padding,
    viewport,
    content,
    items,
    total,
    measure: virtualizer.measureElement,
    focus: setFocused,
    element: (id: string) => virtualizer.elementsCache.get(id),
    measured: (id: string) =>
      virtualizer.elementsCache.has(id) && virtualizer.itemSizeCache.has(id),
    locate: (id: string) =>
      messageOffset(
        virtualizer,
        indexes.get(id),
        viewport.current?.scrollTop ?? 0
      ),
    anchor: () => anchorAt(viewport.current?.scrollTop ?? 0),
    anchorAt,
    nearest: (index: number, sequence?: number | null) =>
      nearestMessage(rows, index, sequence),
  }
}
