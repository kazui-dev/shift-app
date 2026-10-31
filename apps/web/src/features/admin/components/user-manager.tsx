import { QueryError } from "@/components/query-error"
import { functionalUpdate, useTable } from "@tanstack/react-table"
import { DataTable } from "@workspace/ui/components/data-table"
import { dataTableFeatures } from "@workspace/ui/lib/data-table"
import { emptyFilter } from "@workspace/ui/lib/filters"
import type { ManagementTableView } from "@/features/management/management-context"
import { userTableColumns } from "./user-table-columns"
import { accessLevelLabels as labels } from "../access-levels"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { RowSelectionState } from "@tanstack/react-table"
import type { AdminUser } from "@workspace/shared/auth"
import { Button } from "@workspace/ui/components/button"
import { TableSelectionActions } from "@workspace/ui/components/table-selection-actions"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import { usersQuery } from "../data/admin"
import { yearsQuery } from "@/features/years/data/years"
import { UserBulkEditor } from "./user-bulk-editor"

const emptyUsers: AdminUser[] = []
export function UserManager({
  view,
  onDirtyChange,
  onPendingChange,
}: {
  view: ManagementTableView
  onPendingChange?: ((pending: boolean) => void) | undefined
  onDirtyChange: (dirty: boolean) => void
}) {
  const users = useQuery({
    ...usersQuery,
  })
  const years = useQuery({ ...yearsQuery })
  const search = view.search
  const data = users.data?.users ?? emptyUsers
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selected = data.filter((user) => rowSelection[user.id])
  const [editing, setEditing] = useState<{
    kind: "years" | "access"
    users: AdminUser[]
  } | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  useEffect(() => {
    onDirtyChange(editorDirty)
    return () => onDirtyChange(false)
  }, [editorDirty, onDirtyChange])
  const studentId = view.textFilters?.studentId ?? ""
  const yearFilter = view.filters?.years ?? emptyFilter()
  const accessFilter = view.filters?.accessLevel ?? emptyFilter()
  const columns = useMemo(() => userTableColumns(), [])
  const sort = view.sort ?? { column: "studentId", descending: false }
  const sorting = [{ id: sort.column, desc: sort.descending }]
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (user) => user.id,
    enableRowSelection: !editorDirty,
    enableSortingRemoval: false,
    sortDescFirst: false,
    enableMultiSort: false,
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0]
      if (
        next &&
        (next.id === "displayName" ||
          next.id === "studentId" ||
          next.id === "years" ||
          next.id === "accessLevel")
      )
        view.save({ sort: { column: next.id, descending: next.desc } })
    },
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      sorting,
      columnFilters: [
        { id: "displayName", value: search },
        { id: "studentId", value: studentId },
        { id: "years", value: yearFilter },
        { id: "accessLevel", value: accessFilter },
      ],
    },
  })
  const yearOptions = [...new Set(data.flatMap((user) => user.years))].sort(
    (a, b) => b - a
  )
  return (
    <div>
      <ManagementHeaderActions placement="start">
        <TableSelectionActions
          count={selected.length}
          hiddenCount={
            selected.filter(
              (user) =>
                !table.getRowModel().rows.some((row) => row.id === user.id)
            ).length
          }
          disabled={editorDirty}
          onClear={() => setRowSelection({})}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={editorDirty || !years.isSuccess}
            onClick={() => setEditing({ kind: "years", users: selected })}
          >
            年度を変更
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              editorDirty || selected.every((user) => user.isCurrentUser)
            }
            onClick={() => setEditing({ kind: "access", users: selected })}
          >
            権限を変更
          </Button>
        </TableSelectionActions>
      </ManagementHeaderActions>
      {users.isError && (
        <QueryError
          message="ユーザーを読み込めませんでした。"
          onRetry={() => users.refetch()}
        />
      )}
      <DataTable
        sortControls
        selectOnRowClick
        table={table}
        label="ユーザー一覧"
        columnFilters={{
          displayName: {
            kind: "text",
            label: "名前",
            value: search,
            onChange: (value) => view.save({ search: value }),
          },
          studentId: {
            kind: "text",
            label: "学籍番号",
            value: studentId,
            onChange: (value) =>
              view.save({ textFilters: { studentId: value } }),
          },
          years: {
            kind: "choices",
            label: "参加年度",
            options: [
              { value: "unset", label: "未参加" },
              ...yearOptions.map((year) => ({
                value: String(year),
                label: `${year}年度`,
              })),
            ],
            value: yearFilter,
            optionsReady: users.isSuccess && !users.isFetching,
            onChange: (value) => view.save({ filters: { years: value } }),
          },
          accessLevel: {
            kind: "choices",
            label: "システム権限",
            searchable: false,
            optionsReady: true,
            options: Object.entries(labels).map(([value, label]) => ({
              value,
              label,
            })),
            value: accessFilter,
            onChange: (value) => view.save({ filters: { accessLevel: value } }),
          },
        }}
        empty={
          users.isSuccess ? "条件に一致するユーザーはいません。" : undefined
        }
      />
      {editing && (
        <UserBulkEditor
          kind={editing.kind}
          users={editing.users}
          years={years.data?.years.map((year) => year.year) ?? []}
          onDirtyChange={setEditorDirty}
          onPendingChange={onPendingChange}
          onClose={() => setEditing(null)}
          onApplied={() => {
            setEditing(null)
            setRowSelection({})
          }}
        />
      )}
    </div>
  )
}
