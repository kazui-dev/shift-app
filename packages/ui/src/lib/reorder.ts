export function reorderVisibleRows<T extends { id: string }>(
  rows: readonly T[],
  visibleIds: readonly string[],
  from: string,
  to: string,
  editable: (row: T) => boolean
): string[] | null {
  if (new Set(visibleIds).size !== visibleIds.length) return null
  const source = visibleIds.indexOf(from)
  const target = visibleIds.indexOf(to)
  if (source < 0 || target < 0 || source === target) return null
  const movedIds = [...visibleIds]
  movedIds.splice(source, 1)
  movedIds.splice(target, 0, from)
  let index = 0
  const result = rows.map((row) =>
    visibleIds.includes(row.id) ? movedIds[index++] : row.id
  )
  if (result.some((id) => id === undefined)) return null
  const ids = result.filter((id): id is string => id !== undefined)
  if (
    new Set(ids).size !== rows.length ||
    rows.some((row, i) => row.id !== ids[i] && !editable(row))
  )
    return null
  return ids
}
