import type { RowData } from "@tanstack/react-table"
import type { DataColumn } from "./data-table"
export function tableSelectionColumn<T extends RowData>(
  label: string,
  name: (item: T) => string
): DataColumn<T> {
  return {
    id: "select",
    enableSorting: false,
    meta: { width: "2.5rem", leadingControl: true },
    header: ({ table }) => (
      <input
        type="checkbox"
        className="size-4 accent-primary"
        aria-label={`表示中の${label}をすべて選択`}
        disabled={!table.getRowModel().rows.some((row) => row.getCanSelect())}
        checked={table.getIsAllRowsSelected()}
        ref={(input) => {
          if (input) input.indeterminate = table.getIsSomeRowsSelected()
        }}
        onChange={(event) => table.toggleAllRowsSelected(event.target.checked)}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="size-4 accent-primary"
        aria-label={`${name(row.original)}を選択`}
        disabled={!row.getCanSelect()}
        checked={row.getIsSelected()}
        onChange={(event) => row.toggleSelected(event.target.checked)}
      />
    ),
  }
}
