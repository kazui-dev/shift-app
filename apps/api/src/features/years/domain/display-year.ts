export function resolveDisplayYear(
  years: number[],
  defaultYear: number | null,
  selected: number | null
) {
  const unavailableSelection = selected !== null && !years.includes(selected)
  const fallback =
    defaultYear !== null && years.includes(defaultYear)
      ? defaultYear
      : (years[0] ?? null)
  return {
    year: selected !== null && !unavailableSelection ? selected : fallback,
    defaultYear,
    unavailableSelection,
    years,
  }
}
