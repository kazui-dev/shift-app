import { useMemo } from "react"
import { useTable } from "@tanstack/react-table"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import type { YearTag } from "@workspace/shared/shifts"
import { Button } from "@workspace/ui/components/button"
import { DataTable } from "@workspace/ui/components/data-table"
import {
  SortableTable,
  SortableTableRow,
} from "@workspace/ui/components/sortable-table"
import { dataTableFeatures } from "@workspace/ui/lib/data-table"
import { QueryError } from "@/components/query-error"
import { ManagementHeaderActions } from "@/features/management/components/header-actions"
import { TableOrderActions } from "@/features/management/components/table-order-actions"
import type { ManagementTableView } from "@/features/management/management-context"
import { keys } from "@/app/data/keys"
import { useTableOrder } from "@/lib/use-table-order"
import { tagsQuery } from "../data/tags"
import { reorderTags } from "../api/tags"
import { tagTableColumns } from "./tag-table-columns"

const emptyTags: YearTag[] = []
export function YearTagManager({
  year,
  view,
  onStatusChange,
}: {
  year: number
  view: ManagementTableView
  onStatusChange: (status: { dirty: boolean; pending: boolean }) => void
}) {
  const query = useQuery(tagsQuery(year))
  const client = useQueryClient()
  const columns = useMemo(() => tagTableColumns(year), [year])
  const order = useTableOrder({
    data: query.data?.tags ?? emptyTags,
    editable: () => query.isSuccess,
    getLatest: async () =>
      (await client.fetchQuery({ ...tagsQuery(year), staleTime: 0 })).tags,
    persist: (ids) => reorderTags(year, ids),
    refresh: () => client.invalidateQueries({ queryKey: keys.yearTags(year) }),
    conflictMessage:
      "タグの順序が更新されています。キャンセルして最新の順序を確認してください。",
    onStatusChange,
  })
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: order.items,
    getRowId: (tag) => tag.id,
    enableRowSelection: false,
    state: { columnFilters: [{ id: "name", value: view.search }] },
  })
  return (
    <div>
      <ManagementHeaderActions>
        {query.isSuccess && !order.pending ? (
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link
                to="/manage/tags/$year/new"
                params={{ year: String(year) }}
              />
            }
          >
            <Plus />
            タグを作成
          </Button>
        ) : (
          <Button size="sm" disabled>
            <Plus />
            タグを作成
          </Button>
        )}
      </ManagementHeaderActions>
      <TableOrderActions
        dirty={order.dirty}
        pending={order.pending}
        onSave={order.save}
        onCancel={order.cancel}
      />
      {query.isError && (
        <QueryError
          message="タグを取得できませんでした。"
          onRetry={() => query.refetch()}
        />
      )}
      <SortableTable
        items={table.getRowModel().rows.map((row) => ({
          id: row.id,
          label: row.original.name,
          disabled: order.pending || !query.isSuccess,
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
          label="タグ一覧"
          columnFilters={{
            name: {
              kind: "text",
              label: "タグ",
              value: view.search,
              disabled: order.pending,
              onChange: (value) => view.save({ search: value }),
            },
          }}
          empty={
            query.isSuccess
              ? order.items.length
                ? "条件に一致するタグがありません。"
                : "タグがありません。"
              : undefined
          }
        />
      </SortableTable>
    </div>
  )
}
