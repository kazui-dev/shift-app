import type { ComponentProps, ComponentType, ReactNode } from "react"
import type { ReactTable, RowData } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { dataTableFeatures } from "@workspace/ui/lib/data-table"
import { cn } from "@workspace/ui/lib/utils"
import { FilterMenu, TextFilter } from "./filter-menu"
import { filterLabel } from "@workspace/ui/lib/filters"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"

export type DataTableRowProps = ComponentProps<typeof TableRow> & {
  rowId: string
  rowIndex: number
}
function DefaultDataTableRow({
  rowId: _rowId,
  rowIndex: _rowIndex,
  ...props
}: DataTableRowProps) {
  return <TableRow {...props} />
}

type ColumnFilter =
  | ({ kind: "text" } & Omit<ComponentProps<typeof TextFilter>, "iconOnly">)
  | ({ kind: "choices" } & Omit<ComponentProps<typeof FilterMenu>, "iconOnly">)

function columnLabel(fallback: string, filter: ColumnFilter | undefined) {
  if (!filter) return fallback
  return filter.kind === "text"
    ? filter.value.trim() || filter.label
    : filterLabel(
        filter.label,
        filter.options,
        filter.value,
        filter.allowExclusion
      )
}

function ColumnFilterControl({ filter }: { filter: ColumnFilter | undefined }) {
  if (!filter) return null
  return filter.kind === "text" ? (
    <TextFilter {...filter} iconOnly />
  ) : (
    <FilterMenu {...filter} iconOnly />
  )
}

export function DataTable<TData extends RowData>({
  table,
  label,
  empty,
  className,
  sortControls = false,
  selectOnRowClick = false,
  columnFilters,
  columnControls,
  rowComponent: RowComponent = DefaultDataTableRow,
}: {
  table: ReactTable<typeof dataTableFeatures, TData>
  label: string
  empty?: ReactNode
  className?: string
  sortControls?: boolean
  selectOnRowClick?: boolean
  columnFilters?: Partial<Record<string, ColumnFilter>>
  columnControls?: Partial<Record<string, ReactNode>>
  rowComponent?: ComponentType<DataTableRowProps>
}) {
  return (
    <div className="@container min-w-0">
      <table
        aria-label={label}
        className={cn("block w-full table-fixed text-sm @md:table", className)}
      >
        <colgroup>
          {table.getAllLeafColumns().map((column) => (
            <col
              key={column.id}
              style={{ width: column.columnDef.meta?.width }}
            />
          ))}
        </colgroup>
        <TableHeader className="sticky-header block @md:table-header-group [&_tr]:border-0">
          {table.getHeaderGroups().map((group) => (
            <TableRow
              key={group.id}
              className="flex flex-wrap items-center hover:bg-transparent @md:table-row"
            >
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  scope="col"
                  aria-sort={
                    header.column.getCanSort()
                      ? header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                      : undefined
                  }
                  className={cn(
                    "px-2 text-xs text-muted-foreground",
                    header.column.columnDef.meta?.className,
                    "flex items-center @md:table-cell"
                  )}
                >
                  {!header.isPlaceholder &&
                    (typeof header.column.columnDef.header === "string" ? (
                      <DataTableColumnHeader
                        label={columnLabel(
                          header.column.columnDef.header,
                          columnFilters?.[header.column.id]
                        )}
                        control={columnControls?.[header.column.id]}
                        sorted={header.column.getIsSorted()}
                        onSort={
                          sortControls && header.column.getCanSort()
                            ? () => header.column.toggleSorting()
                            : undefined
                        }
                      >
                        <ColumnFilterControl
                          filter={columnFilters?.[header.column.id]}
                        />
                      </DataTableColumnHeader>
                    ) : (
                      <table.FlexRender header={header} />
                    ))}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="block @md:table-row-group">
          {table.getRowModel().rows.map((row, rowIndex) => (
            <RowComponent
              key={row.id}
              rowId={row.id}
              rowIndex={rowIndex}
              data-state={row.getIsSelected() ? "selected" : undefined}
              className={cn(
                "group/row relative grid grid-cols-[auto_minmax(0,1fr)] py-2 @md:table-row @md:py-0",
                selectOnRowClick && row.getCanSelect() && "cursor-pointer"
              )}
              onClick={
                selectOnRowClick
                  ? (event) => {
                      if (
                        !row.getCanSelect() ||
                        !(event.target instanceof Element) ||
                        event.target.closest(
                          "button, a, input, select, textarea, label, [role=button]"
                        )
                      )
                        return
                      row.toggleSelected()
                    }
                  : undefined
              }
            >
              {row.getAllCells().map((cell, index) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "px-2 whitespace-normal",
                    cell.column.columnDef.meta?.leadingControl ||
                      (index === 1 &&
                        row.getAllCells()[0]?.column.columnDef.meta
                          ?.leadingControl)
                      ? "col-span-1 self-center"
                      : "col-span-2",
                    cell.column.columnDef.meta?.className,
                    "block py-1 @md:table-cell @md:h-12 @md:py-2"
                  )}
                >
                  {cell.column.columnDef.meta?.label && (
                    <span className="mr-1 text-xs text-muted-foreground @md:hidden">
                      {cell.column.columnDef.meta.label}：
                    </span>
                  )}
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </RowComponent>
          ))}
          {!table.getRowModel().rows.length && empty && (
            <TableRow>
              <TableCell
                colSpan={table.getAllLeafColumns().length}
                className="py-8 text-center text-muted-foreground"
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </table>
    </div>
  )
}

export function DataTableColumnHeader({
  label,
  sorted,
  onSort,
  children,
  control,
}: {
  label: string
  sorted?: false | "asc" | "desc"
  onSort?: (() => void) | undefined
  children?: ReactNode
  control?: ReactNode
}) {
  return (
    <div className="flex min-h-10 min-w-0 items-center gap-1.5 py-1">
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "flex min-h-8 min-w-0 items-center gap-1 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring",
            control && "shrink-0"
          )}
        >
          <span className="truncate" title={label}>
            {label}
          </span>
          {sorted === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0" />
          ) : sorted === "desc" ? (
            <ArrowDown className="size-3.5 shrink-0" />
          ) : (
            <ArrowUpDown className="size-3.5 shrink-0" />
          )}
        </button>
      ) : (
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
      )}
      {children && (
        <span className="flex shrink-0 items-center">{children}</span>
      )}
      {control && <div className="min-w-0 flex-1">{control}</div>}
    </div>
  )
}
