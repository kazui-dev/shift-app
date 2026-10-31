import { QueryError } from "@/components/query-error"
import {
  SortableTable,
  SortableTableRow,
} from "@workspace/ui/components/sortable-table"
import { useTableOrder } from "@/lib/use-table-order"
import { TableOrderActions } from "@/features/management/components/table-order-actions"
import { useTable } from "@tanstack/react-table"
import { DataTable } from "@workspace/ui/components/data-table"
import { dataTableFeatures } from "@workspace/ui/lib/data-table"
import { emptyFilter } from "@workspace/ui/lib/filters"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import type { ManagementTableView } from "@/features/management/management-context"
import { roleTableColumns, type RoleTableRow } from "./role-table-columns"
import { useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { rolesQuery } from "@/features/years/data/years"
import { keys } from "@/app/data/keys"
import { reorderRoles } from "@/features/years/api/years"
import { permissions } from "./role-permissions"

const emptyRoles: RoleTableRow[] = []

export function YearRoleManager({
  year,
  view,
  onStatusChange,
}: {
  year: number
  view: ManagementTableView
  onStatusChange?: (status: { dirty: boolean; pending: boolean }) => void
}) {
  const query = useQuery({
    ...rolesQuery(year),
  })
  const client = useQueryClient()
  const search = view.search
  const authority = query.data?.authority
  const permissionFilter = view.filters?.permissions ?? emptyFilter()
  const editable = useCallback(
    (position: number) =>
      !!authority &&
      (authority.systemAdmin ||
        (authority.permissions.includes("role.manage") &&
          position < (authority.position ?? Number.NEGATIVE_INFINITY))),
    [authority]
  )
  const canCreate =
    !!authority &&
    (authority.systemAdmin || authority.permissions.includes("role.manage"))
  const columns = useMemo(() => roleTableColumns({ year }), [year])
  const order = useTableOrder({
    data: query.data?.roles ?? emptyRoles,
    editable: (role) => editable(role.position),
    getLatest: async () =>
      (await client.fetchQuery({ ...rolesQuery(year), staleTime: 0 })).roles,
    persist: (ids) => reorderRoles(year, ids),
    refresh: () => client.invalidateQueries({ queryKey: keys.yearRoles(year) }),
    conflictMessage:
      "ロールの順序が更新されています。キャンセルして最新の順序を確認してください。",
    onStatusChange,
  })
  const roles = order.items
  const ordering = order.pending
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: roles,
    getRowId: (role) => role.id,
    enableRowSelection: false,
    state: {
      columnFilters: [
        { id: "name", value: search },
        { id: "permissions", value: permissionFilter },
      ],
    },
  })
  return (
    <div>
      <ManagementHeaderActions>
        {canCreate && !ordering ? (
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link
                to="/manage/roles/$year/new"
                params={{ year: String(year) }}
              />
            }
          >
            <Plus />
            ロールを作成
          </Button>
        ) : (
          <Button size="sm" disabled>
            <Plus />
            ロールを作成
          </Button>
        )}
      </ManagementHeaderActions>
      <TableOrderActions
        dirty={order.dirty}
        pending={ordering}
        onSave={order.save}
        onCancel={order.cancel}
      />
      {query.isError && (
        <QueryError
          message="ロールを取得できませんでした。"
          onRetry={() => query.refetch()}
        />
      )}
      <SortableTable
        items={table.getRowModel().rows.map((row) => ({
          id: row.id,
          label: row.original.name,
          disabled: ordering || !editable(row.original.position),
        }))}
        onMove={(from, to) =>
          order.move(
            table.getRowModel().rows.map((row) => row.id),
            from,
            to
          )
        }
        onDraggingChange={order.setDragging}
      >
        <DataTable
          rowComponent={SortableTableRow}
          table={table}
          label="ロール一覧"
          columnFilters={{
            name: {
              kind: "text",
              label: "ロール",
              value: search,
              disabled: ordering,
              onChange: (value) => view.save({ search: value }),
            },
            permissions: {
              kind: "choices",
              label: "管理権限",
              disabled: ordering,
              searchable: false,
              optionsReady: true,
              options: [
                { value: "unset", label: "管理権限なし" },
                ...permissions,
              ],
              value: permissionFilter,
              onChange: (value) =>
                view.save({ filters: { permissions: value } }),
            },
          }}
          empty={
            query.isSuccess
              ? roles.length
                ? "条件に一致するロールがありません。"
                : "ロールがありません。"
              : undefined
          }
        />
      </SortableTable>
    </div>
  )
}
