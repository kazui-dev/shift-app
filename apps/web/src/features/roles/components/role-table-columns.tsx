import { Link } from "@tanstack/react-router"
import { TableDragHandle } from "@workspace/ui/components/sortable-table"
import {
  matchesTableFilter,
  matchesTableSearch,
  type DataColumn,
} from "@workspace/ui/lib/data-table"
import type { getYearRoles } from "@/features/years/api/years"
import { permissions } from "./role-permissions"

export type RoleTableRow = Awaited<
  ReturnType<typeof getYearRoles>
>["roles"][number]

export function roleTableColumns({
  year,
}: {
  year: number
}): DataColumn<RoleTableRow>[] {
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
      accessorFn: (role) => role.name,
      enableSorting: false,
      header: "ロール",
      meta: { width: "35%" },
      filterFn: (row, _id, value: unknown) =>
        matchesTableSearch(row.original.name, value),
      cell: ({ row }) => {
        const content = (
          <>
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.original.color }}
            />
            <span className="min-w-0 break-words group-hover/link:underline">
              {row.original.name}
            </span>
          </>
        )
        return (
          <Link
            to="/manage/roles/$year/$roleId"
            params={{ year: String(year), roleId: row.id }}
            aria-label={`${row.original.name}のメンバーを表示`}
            className="group/link flex items-center gap-3 rounded-sm font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {content}
          </Link>
        )
      },
    },
    {
      id: "permissions",
      accessorFn: (role) => role.permissions,
      enableSorting: false,
      header: "管理権限",
      meta: { label: "管理権限", className: "text-xs text-muted-foreground" },
      filterFn: (row, _id, value: unknown) =>
        matchesTableFilter(row.original.permissions, value),
      cell: ({ row }) =>
        permissions
          .filter((permission) =>
            row.original.permissions.includes(permission.value)
          )
          .map((permission) => permission.label)
          .join("、") || "管理権限なし",
    },
  ]
}
