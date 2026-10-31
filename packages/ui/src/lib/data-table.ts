import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"
import { matchesFilter } from "./filters"

const columnMeta: {
  label?: string
  leadingControl?: boolean
  className?: string
  width?: string
} = {}

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  columnMeta,
})
export type DataColumn<TData extends RowData> = ColumnDef<
  typeof dataTableFeatures,
  TData
>

/** TanStack filter values are unknown; retain the application's OR/exclusion semantics. */
export function matchesTableFilter(
  candidates: readonly string[],
  value: unknown
) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("include" in value) ||
    !("exclude" in value)
  )
    return false
  if (!Array.isArray(value.include) || !Array.isArray(value.exclude))
    return false
  const include = value.include.filter(
    (item: unknown): item is string => typeof item === "string"
  )
  const exclude = value.exclude.filter(
    (item: unknown): item is string => typeof item === "string"
  )
  if (
    include.length !== value.include.length ||
    exclude.length !== value.exclude.length
  )
    return false
  return matchesFilter(candidates, { include, exclude })
}

export function matchesTableSearch(text: string, value: unknown) {
  return (
    typeof value === "string" &&
    text.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())
  )
}
