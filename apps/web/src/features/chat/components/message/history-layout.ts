import type { Virtualizer } from "@tanstack/react-virtual"

type Coordinates = Pick<
  Virtualizer<HTMLElement, HTMLLIElement>,
  "getVirtualItemForOffset"
>

/** A pixel window, so hundreds of short messages do not expand the DOM budget. */
export function historyWindow(
  coordinates: Coordinates,
  top: number,
  height: number,
  focused?: number
): number[] {
  const start = coordinates.getVirtualItemForOffset(
    Math.max(0, top - height * 2)
  )?.index
  const end = coordinates.getVirtualItemForOffset(top + height * 3)?.index
  if (start === undefined || end === undefined) return []
  const result = Array.from(
    { length: end - start + 1 },
    (_, index) => start + index
  )
  if (focused !== undefined && (focused < start || focused > end))
    result.push(focused)
  return result.sort((a, b) => a - b)
}

/** Sequence survives deleted rows and prepends between visits; pending rows use index. */
export function nearestMessage(
  rows: readonly { id: string; sequence: number | null }[],
  index: number,
  sequence?: number | null
) {
  if (sequence != null) {
    let low = 0
    let high = rows.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      const candidate = rows[middle]?.sequence
      if (candidate != null && candidate < sequence) low = middle + 1
      else high = middle
    }
    return rows[Math.min(low, rows.length - 1)]?.id ?? null
  }
  return rows[Math.min(index, rows.length - 1)]?.id ?? null
}

/** Flush pending measurements before looking up coordinates, including during React commit. */
export function messageOffset(
  coordinates: Pick<
    Virtualizer<HTMLElement, HTMLLIElement>,
    "getTotalSize" | "measurementsCache"
  >,
  index: number | undefined,
  top: number
) {
  coordinates.getTotalSize()
  const item =
    index === undefined ? undefined : coordinates.measurementsCache[index]
  return item ? item.start - top : null
}
