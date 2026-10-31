import { tableSelectionColumn } from "@workspace/ui/lib/table-selection-column"
import {
  matchesTableFilter,
  type DataColumn,
} from "@workspace/ui/lib/data-table"
import type { getRoster } from "@/features/years/api/years"
import { memberIdentityColumns } from "./member-identity-columns"

export type MemberTableRow = Awaited<
  ReturnType<typeof getRoster>
>["members"][number] & {
  tags: { id: string; name: string }[]
}

export function memberTableColumns({
  pending,
  rolesDisabled,
  tagsDisabled,
  tagsLoading,
  tagsError,
  tagsUnavailable = false,
  onEdit,
}: {
  pending: boolean
  rolesDisabled: boolean
  tagsDisabled: boolean
  tagsLoading: boolean
  tagsError: boolean
  tagsUnavailable?: boolean
  onEdit: ((kind: "role" | "tag", ids: string[]) => void) | null
}): DataColumn<MemberTableRow>[] {
  return [
    tableSelectionColumn<MemberTableRow>(
      "メンバー",
      (member) => member.displayName
    ),
    ...memberIdentityColumns<MemberTableRow>("24%", "17%"),
    {
      id: "roles",
      accessorFn: (item) => item.roles,
      enableSorting: false,
      meta: {
        label: "ロール",
        width: "30%",
        className: "text-xs text-muted-foreground",
      },
      filterFn: (row, _id, value: unknown) =>
        matchesTableFilter(
          row.original.roles.map((role) => role.id),
          value
        ),
      header: "ロール",
      cell: ({ row }) =>
        onEdit ? (
          <button
            type="button"
            className="max-w-full rounded-sm py-1 text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${row.original.displayName}のロールを変更`}
            disabled={pending || rolesDisabled}
            onClick={() => onEdit?.("role", [row.id])}
          >
            {row.original.roles.map((role) => role.name).join("、") || "—"}
          </button>
        ) : (
          row.original.roles.map((role) => role.name).join("、") || "—"
        ),
    },
    {
      id: "tags",
      accessorFn: (item) => item.tags,
      enableSorting: false,
      filterFn: (row, _id, value: unknown) =>
        matchesTableFilter(
          row.original.tags.map((tag) => tag.id),
          value
        ),
      meta: { label: "タグ", className: "text-xs text-muted-foreground" },
      header: "タグ",
      cell: ({ row }) => {
        const content = tagsUnavailable
          ? "閲覧不可"
          : tagsLoading
            ? "読み込み中…"
            : tagsError
              ? "取得失敗"
              : row.original.tags.map((tag) => tag.name).join("、") || "—"
        return onEdit ? (
          <button
            type="button"
            className="max-w-full rounded-sm py-1 text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${row.original.displayName}のタグを変更`}
            disabled={pending || tagsDisabled}
            onClick={() => onEdit("tag", [row.id])}
          >
            {content}
          </button>
        ) : (
          content
        )
      },
    },
  ]
}
