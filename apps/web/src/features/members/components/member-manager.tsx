import { QueryError } from "@/components/query-error"
import { TableSelectionActions } from "@workspace/ui/components/table-selection-actions"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  useTable,
  functionalUpdate,
  type RowSelectionState,
} from "@tanstack/react-table"
import { dataTableFeatures } from "@workspace/ui/lib/data-table"
import { DataTable } from "@workspace/ui/components/data-table"
import { memberTableColumns } from "./member-table-columns"
import { rosterQuery, rolesQuery } from "@/features/years/data/years"
import { tagsQuery } from "../data/tags"
import {
  emptyFilter,
  filterValues,
  type FilterValue,
} from "@workspace/ui/lib/filters"
import { MemberRoleEditor } from "./member-role-editor"
import { MemberTagEditor } from "./member-tag-editor"
import type { ManagementScreenView } from "@/features/management/management-context"

export function MemberManager({
  year,
  view,
  onDirtyChange,
  onPendingChange,
}: {
  year: number
  view: {
    search: string
    textFilters?: Record<string, string> | undefined
    filters?: Record<string, FilterValue> | undefined
    sort?: ManagementScreenView["sort"]
    save: (
      patch: Partial<{
        search: string
        textFilters: Record<string, string>
        filters: Record<string, FilterValue>
        sort: NonNullable<ManagementScreenView["sort"]>
      }>
    ) => void
  }
  onPendingChange?: ((pending: boolean) => void) | undefined
  onDirtyChange: (dirty: boolean) => void
}) {
  const roster = useQuery(rosterQuery(year))
  const roles = useQuery(rolesQuery(year))
  const tags = useQuery(tagsQuery(year))
  const search = view.search
  const studentIdSearch = view.textFilters?.studentId ?? ""
  const roleFilter = view.filters?.roles ?? emptyFilter()
  const tagFilter = view.filters?.tags ?? emptyFilter()
  const sort = view.sort ?? { column: "studentId", descending: false }
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selected = (roster.data?.members ?? [])
    .filter((member) => rowSelection[member.id])
    .map((member) => member.id)
  function setSelected(ids: string[]) {
    setRowSelection(Object.fromEntries(ids.map((id) => [id, true])))
  }
  const [editing, setEditing] = useState<{
    kind: "role" | "tag"
    ids: string[]
  } | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  useEffect(() => {
    onDirtyChange(editorDirty)
    return () => onDirtyChange(false)
  }, [editorDirty, onDirtyChange])
  const data = useMemo(() => {
    const memberTags = new Map<string, { id: string; name: string }[]>()
    for (const tag of tags.data?.tags ?? []) {
      for (const id of tag.memberIds) {
        const assigned = memberTags.get(id) ?? []
        assigned.push({ id: tag.id, name: tag.name })
        memberTags.set(id, assigned)
      }
    }
    return (roster.data?.members ?? []).map((member) => ({
      ...member,
      tags: memberTags.get(member.id) ?? [],
    }))
  }, [roster.data, tags.data])
  const editMember = useCallback(
    (kind: "role" | "tag", ids: string[]) => setEditing({ kind, ids }),
    [setEditing]
  )
  const columns = useMemo(
    () =>
      memberTableColumns({
        pending: editorDirty,
        rolesDisabled: roles.isPending || roles.isError,
        tagsDisabled: !tags.data || tags.isError,
        tagsLoading: tags.isPending,
        tagsError: tags.isError,
        onEdit: editMember,
      }),
    [
      editorDirty,
      roles.isPending,
      roles.isError,
      tags.data,
      tags.isError,
      tags.isPending,
      editMember,
    ]
  )
  const sorting = [{ id: sort.column, desc: sort.descending }]
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (member) => member.id,
    enableSortingRemoval: false,
    sortDescFirst: false,
    enableMultiSort: false,
    enableRowSelection: !editorDirty,
    state: {
      rowSelection,
      sorting,
      columnFilters: [
        { id: "displayName", value: search },
        { id: "studentId", value: studentIdSearch },
        { id: "roles", value: roleFilter },
        { id: "tags", value: tagFilter },
      ],
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0]
      if (next && (next.id === "displayName" || next.id === "studentId"))
        view.save({ sort: { column: next.id, descending: next.desc } })
    },
  })
  const members = table.getRowModel().rows.map((row) => row.original)
  const hiddenSelected = selected.filter(
    (id) => !members.some((member) => member.id === id)
  ).length
  const roleItems = (roles.data?.roles ?? []).map((role) => ({
    ...role,
    memberIds: (roster.data?.members ?? [])
      .filter((member) => member.roles.some((item) => item.id === role.id))
      .map((member) => member.id),
  }))
  function applied() {
    setEditing(null)
    setSelected([])
  }
  function clearFilters() {
    view.save({
      search: "",
      textFilters: {},
      filters: { roles: emptyFilter(), tags: emptyFilter() },
    })
  }
  const activeFilters = Boolean(
    search ||
    studentIdSearch ||
    filterValues(roleFilter).length ||
    filterValues(tagFilter).length
  )
  return (
    <div>
      <ManagementHeaderActions>
        {activeFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X />
            絞り込みを解除
          </Button>
        )}
      </ManagementHeaderActions>
      <ManagementHeaderActions placement="start">
        <TableSelectionActions
          count={selected.length}
          hiddenCount={hiddenSelected}
          disabled={editorDirty}
          onClear={() => setSelected([])}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={editorDirty || roles.isPending || roles.isError}
            onClick={() => setEditing({ kind: "role", ids: selected })}
          >
            ロールを変更
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={editorDirty || !tags.data || tags.isError}
            onClick={() => setEditing({ kind: "tag", ids: selected })}
          >
            タグを変更
          </Button>
        </TableSelectionActions>
      </ManagementHeaderActions>
      {tags.isError && (
        <QueryError
          message="タグを読み込めませんでした。"
          onRetry={() => tags.refetch()}
        />
      )}
      {roles.isError && (
        <QueryError
          message="ロールを読み込めませんでした。"
          onRetry={() => roles.refetch()}
        />
      )}
      {roster.isError && (
        <QueryError
          message="メンバーを読み込めませんでした。"
          onRetry={() => roster.refetch()}
        />
      )}
      <DataTable
        selectOnRowClick
        table={table}
        sortControls
        columnFilters={{
          displayName: {
            kind: "text",
            label: "名前",
            placeholder: "名前を入力",
            value: search,
            onChange: (value) => view.save({ search: value }),
          },
          studentId: {
            kind: "text",
            label: "学籍番号",
            placeholder: "学籍番号を入力",
            value: studentIdSearch,
            onChange: (value) =>
              view.save({ textFilters: { studentId: value } }),
          },
          roles: {
            kind: "choices",
            label: "ロール",
            value: roleFilter,
            options: [
              { value: "unset", label: "未設定" },
              ...(roles.data?.roles ?? []).map((role) => ({
                value: role.id,
                label: role.name,
              })),
            ],
            disabled: roles.isPending || roles.isError,
            optionsReady: roles.isSuccess && !roles.isFetching,
            onChange: (value) => view.save({ filters: { roles: value } }),
          },
          tags: {
            kind: "choices",
            label: "タグ",
            value: tagFilter,
            options: [
              { value: "unset", label: "未設定" },
              ...(tags.data?.tags ?? []).map((tag) => ({
                value: tag.id,
                label: tag.name,
              })),
            ],
            disabled: !tags.data || tags.isError,
            optionsReady: tags.isSuccess && !tags.isFetching,
            onChange: (value) => view.save({ filters: { tags: value } }),
          },
        }}
        label="メンバー一覧"
        empty={
          roster.isSuccess ? "条件に一致するメンバーはいません。" : undefined
        }
      />
      {editing?.kind === "role" && (
        <MemberRoleEditor
          year={year}
          memberIds={editing.ids}
          roles={roleItems}
          onDirtyChange={setEditorDirty}
          onPendingChange={onPendingChange}
          onClose={() => setEditing(null)}
          onApplied={applied}
        />
      )}
      {editing?.kind === "tag" && (
        <MemberTagEditor
          year={year}
          memberIds={editing.ids}
          tags={tags.data?.tags ?? []}
          onDirtyChange={setEditorDirty}
          onPendingChange={onPendingChange}
          onClose={() => setEditing(null)}
          onApplied={applied}
        />
      )}
    </div>
  )
}
