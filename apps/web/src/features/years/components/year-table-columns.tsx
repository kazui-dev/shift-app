import {
  matchesTableFilter,
  matchesTableSearch,
  type DataColumn,
} from "@workspace/ui/lib/data-table"
import type { getYears } from "../api/years"

export type YearTableRow = Awaited<ReturnType<typeof getYears>>["years"][number]

export function yearTableColumns(
  pending: boolean,
  onDefault: (year: number) => void
): DataColumn<YearTableRow>[] {
  return [
    {
      id: "year",
      accessorFn: (item) => item.year,
      enableSorting: false,
      header: "年度",
      meta: { width: "45%", className: "font-medium tabular-nums" },
      filterFn: (row, _id, value: unknown) =>
        matchesTableSearch(String(row.original.year), value),
      cell: ({ row }) => `${row.original.year}年度`,
    },
    {
      id: "default",
      accessorFn: (item) => item.isDefault,
      enableSorting: false,
      header: "デフォルト年度",
      meta: { className: "text-xs text-muted-foreground" },
      filterFn: (row, _id, value: unknown) =>
        matchesTableFilter(
          [row.original.isDefault ? "default" : "other"],
          value
        ),
      cell: ({ row }) => (
        <label className="inline-flex min-h-8 cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="default-year"
            aria-label={`${row.original.year}年度をデフォルトに設定`}
            className="size-4 accent-primary"
            checked={row.original.isDefault}
            disabled={pending}
            onChange={() => onDefault(row.original.year)}
          />
          {row.original.isDefault ? "設定中" : "設定する"}
        </label>
      ),
    },
  ]
}
