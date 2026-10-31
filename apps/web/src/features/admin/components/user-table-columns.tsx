import { accessLevelLabels } from "../access-levels"
import { tableSelectionColumn } from "@workspace/ui/lib/table-selection-column"
import type { AdminUser } from "@workspace/shared/auth"
import {
  matchesTableFilter,
  type DataColumn,
} from "@workspace/ui/lib/data-table"
import { memberIdentityColumns } from "@/features/members/components/member-identity-columns"

const accessLevelOrder = { member: 0, leader: 1, system_admin: 2 }

export function userTableColumns(): DataColumn<AdminUser>[] {
  return [
    tableSelectionColumn<AdminUser>("ユーザー", (user) => user.displayName),
    ...memberIdentityColumns<AdminUser>("32%", "22%"),
    {
      id: "years",
      accessorFn: (user) => Math.max(0, ...user.years),
      sortFn: (a, b) =>
        Math.max(0, ...a.original.years) - Math.max(0, ...b.original.years),
      header: "参加年度",
      meta: {
        label: "参加年度",
        width: "22%",
        className: "text-xs text-muted-foreground",
      },
      filterFn: (row, _id, value: unknown) =>
        matchesTableFilter(row.original.years.map(String), value),
      cell: ({ row }) => row.original.years.join("・") || "未参加",
    },
    {
      accessorKey: "accessLevel",
      sortFn: (a, b) =>
        accessLevelOrder[a.original.accessLevel] -
        accessLevelOrder[b.original.accessLevel],
      header: "システム権限",
      meta: {
        label: "システム権限",
        className: "text-xs text-muted-foreground",
      },
      filterFn: (row, _id, value: unknown) =>
        matchesTableFilter([row.original.accessLevel], value),
      cell: ({ row }) => accessLevelLabels[row.original.accessLevel],
    },
  ]
}
