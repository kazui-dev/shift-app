import { MemberSearch } from "@/features/members/components/member-search"
import { useMemo } from "react"
import {
  functionalUpdate,
  useTable,
  type OnChangeFn,
  type RowSelectionState,
} from "@tanstack/react-table"
import { DataTable } from "@workspace/ui/components/data-table"
import {
  dataTableFeatures,
  matchesTableSearch,
} from "@workspace/ui/lib/data-table"
import { emptyFilter } from "@workspace/ui/lib/filters"
import type { ManagementTableView } from "@/features/management/management-context"
import { memberTableColumns, type MemberTableRow } from "./member-table-columns"

export function MemberSelectionTable({
  members,
  selection,
  onSelectionChange,
  canSelect,
  view,
  label,
  empty,
  roles,
  rolesReady,
  tagsReady,
  tags,
  tagsLoading,
  tagsError,
  tagsUnavailable,
}: {
  members: MemberTableRow[]
  selection: RowSelectionState
  onSelectionChange: OnChangeFn<RowSelectionState>
  canSelect: (member: MemberTableRow) => boolean
  view: ManagementTableView
  label: string
  empty: string
  rolesReady: boolean
  tagsReady: boolean
  roles: { id: string; name: string }[]
  tags: { id: string; name: string }[]
  tagsLoading: boolean
  tagsError: boolean
  tagsUnavailable: boolean
}) {
  const columns = useMemo(
    () =>
      memberTableColumns({
        pending: false,
        rolesDisabled: true,
        tagsDisabled: true,
        tagsLoading,
        tagsError,
        tagsUnavailable,
        onEdit: null,
      }),
    [tagsLoading, tagsError, tagsUnavailable]
  )
  const roleFilter = view.filters?.roles ?? emptyFilter()
  const tagFilter = view.filters?.tags ?? emptyFilter()
  const sort = view.sort ?? { column: "studentId", descending: false }
  const sorting = [{ id: sort.column, desc: sort.descending }]
  const table = useTable({
    features: dataTableFeatures,
    globalFilterFn: (row, columnId, value: unknown) =>
      matchesTableSearch(row.getValue<string>(columnId), value),
    getColumnCanGlobalFilter: (column) =>
      column.id === "displayName" || column.id === "studentId",
    columns,
    data: members,
    getRowId: (member) => member.id,
    enableRowSelection: (row) => canSelect(row.original),
    onRowSelectionChange: onSelectionChange,
    enableSortingRemoval: false,
    sortDescFirst: false,
    enableMultiSort: false,
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0]
      if (next && (next.id === "displayName" || next.id === "studentId"))
        view.save({ sort: { column: next.id, descending: next.desc } })
    },
    state: {
      globalFilter: view.search.trim(),
      rowSelection: selection,
      sorting,
      columnFilters: [
        { id: "roles", value: roleFilter },
        {
          id: "tags",
          value:
            tagsUnavailable || tagsLoading || tagsError
              ? emptyFilter()
              : tagFilter,
        },
      ],
    },
  })
  return (
    <DataTable
      columnControls={{
        displayName: (
          <MemberSearch
            value={view.search}
            onChange={(search) => view.save({ search })}
          />
        ),
      }}
      selectOnRowClick
      sortControls
      table={table}
      label={label}
      empty={empty}
      columnFilters={{
        roles: {
          kind: "choices",
          label: "ロール",
          options: [
            { value: "unset", label: "未設定" },
            ...roles.map((role) => ({ value: role.id, label: role.name })),
          ],
          value: roleFilter,
          optionsReady: rolesReady,
          disabled: !rolesReady,
          onChange: (value) =>
            view.save({ filters: { ...view.filters, roles: value } }),
        },
        tags: {
          kind: "choices",
          label: "タグ",
          options: [
            { value: "unset", label: "未設定" },
            ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
          ],
          value: tagFilter,
          optionsReady: tagsReady,
          disabled: tagsLoading || tagsError || tagsUnavailable,
          onChange: (value) =>
            view.save({ filters: { ...view.filters, tags: value } }),
        },
      }}
    />
  )
}
