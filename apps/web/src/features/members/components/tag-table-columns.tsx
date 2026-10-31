import { Link } from "@tanstack/react-router"
import type { YearTag } from "@workspace/shared/shifts"
import { TableDragHandle } from "@workspace/ui/components/sortable-table"
import {
  matchesTableSearch,
  type DataColumn,
} from "@workspace/ui/lib/data-table"

export function tagTableColumns(year: number): DataColumn<YearTag>[] {
  return [
    {
      id: "order",
      header: () => <span className="sr-only">並び順</span>,
      enableSorting: false,
      meta: { width: "3rem", leadingControl: true },
      cell: ({ row }) => <TableDragHandle label={row.original.name} />,
    },
    {
      id: "name",
      accessorFn: (tag) => tag.name,
      enableSorting: false,
      header: "タグ",
      meta: { width: "65%" },
      filterFn: (row, _id, value: unknown) =>
        matchesTableSearch(row.original.name, value),
      cell: ({ row }) => (
        <Link
          to="/manage/tags/$year/$tagId"
          params={{ year: String(year), tagId: row.id }}
          aria-label={`${row.original.name}のメンバーを表示`}
          className="group/link flex items-center gap-3 rounded-sm font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="min-w-0 break-words group-hover/link:underline">
            {row.original.name}
          </span>
        </Link>
      ),
    },
    {
      id: "memberCount",
      accessorFn: (tag) => tag.memberIds.length,
      enableSorting: false,
      header: "メンバー",
      meta: {
        label: "メンバー",
        className: "text-xs text-muted-foreground tabular-nums",
      },
      cell: ({ row }) => `${row.original.memberIds.length}人`,
    },
  ]
}
