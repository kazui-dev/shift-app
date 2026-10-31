export type FilterValue = { values: string[]; mode: "include" | "exclude" }
export const emptyFilter = (): FilterValue => ({ values: [], mode: "include" })

/** Call only with a complete option list after a successful load. */
export function pruneFilter(
  filter: FilterValue,
  available: readonly string[]
): FilterValue {
  const values = filter.values.filter((id) => available.includes(id))
  return values.length === filter.values.length ? filter : { ...filter, values }
}

/** OR within a column; callers combine independent columns with AND. */
export function matchesFilter(
  candidates: readonly string[],
  filter: FilterValue
): boolean {
  if (!filter.values.length) return true
  const values = candidates.length ? candidates : ["unset"]
  const matches = values.some((value) => filter.values.includes(value))
  return filter.mode === "exclude" ? !matches : matches
}
