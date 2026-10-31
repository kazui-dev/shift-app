export type FilterValue = { include: string[]; exclude: string[] }
export const emptyFilter = (): FilterValue => ({ include: [], exclude: [] })
export const filterValues = (filter: FilterValue): string[] => [
  ...filter.include,
  ...filter.exclude,
]

/** A value belongs to one condition; explicitly selecting it moves it there. */
export function selectFilterValues(
  filter: FilterValue,
  mode: keyof FilterValue,
  values: string[]
): FilterValue {
  const other = mode === "include" ? "exclude" : "include"
  return {
    ...filter,
    [mode]: values,
    [other]: filter[other].filter((value) => !values.includes(value)),
  }
}

/** Call only with a complete option list after a successful load. */
export function pruneFilter(
  filter: FilterValue,
  available: readonly string[]
): FilterValue {
  const include = filter.include.filter((id) => available.includes(id))
  const exclude = filter.exclude.filter((id) => available.includes(id))
  return include.length === filter.include.length &&
    exclude.length === filter.exclude.length
    ? filter
    : { include, exclude }
}

/** OR within included values; any excluded match wins. Independent columns use AND. */
export function matchesFilter(
  candidates: readonly string[],
  filter: FilterValue
): boolean {
  const values = candidates.length ? candidates : ["unset"]
  return (
    (!filter.include.length ||
      values.some((value) => filter.include.includes(value))) &&
    !values.some((value) => filter.exclude.includes(value))
  )
}

/** Resolve labels against all options, independently of the popup search. */
export function filterLabel(
  label: string,
  options: readonly { value: string; label: string }[],
  filter: FilterValue,
  allowExclusion = true
): string {
  const selected = filterValues(filter)
  if (!selected.length) return label
  const single =
    selected.length === 1
      ? options.find((option) => option.value === selected[0])
      : undefined
  return single
    ? `${single.label}${allowExclusion && filter.exclude.length ? "を除外" : ""}`
    : `${label} (${selected.length})`
}

/** Describe both sets for tooltips and printed shift sheets. */
export function filterDescription(
  options: readonly { value: string; label: string }[],
  filter: FilterValue,
  allowExclusion = true
): string {
  const names = (values: string[]) =>
    values
      .map(
        (value) =>
          options.find((option) => option.value === value)?.label ?? value
      )
      .join("、")
  return (
    [
      filter.include.length
        ? `${allowExclusion ? "含む " : ""}${names(filter.include)}`
        : "",
      filter.exclude.length ? `含まない ${names(filter.exclude)}` : "",
    ]
      .filter(Boolean)
      .join(" ／ ") || "すべて"
  )
}
