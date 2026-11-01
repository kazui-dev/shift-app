import type { DataColumn } from "@workspace/ui/lib/data-table"
import { MemberAvatar } from "./member-avatar"

export type MemberIdentity = {
  id: string
  displayName: string
  studentId: string
  image: string | null
}
export function memberIdentityColumns<T extends MemberIdentity>(
  nameWidth: string,
  studentIdWidth: string
): DataColumn<T>[] {
  return [
    {
      id: "displayName",
      accessorFn: (member) => member.displayName,
      header: "名前",
      meta: { width: nameWidth },
      sortFn: (a, b) =>
        a.original.displayName.localeCompare(b.original.displayName, "ja", {
          numeric: true,
        }),
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <MemberAvatar
            name={row.original.displayName}
            image={row.original.image}
          />
          <span className="min-w-0 font-medium break-words group-hover/row:underline">
            {row.original.displayName}
          </span>
        </div>
      ),
    },
    {
      id: "studentId",
      accessorFn: (member) => member.studentId,
      header: "学籍番号",
      meta: {
        label: "学籍番号",
        width: studentIdWidth,
        className: "text-xs text-muted-foreground tabular-nums",
      },
      sortFn: (a, b) =>
        a.original.studentId.localeCompare(b.original.studentId, "ja", {
          numeric: true,
        }),
      enableColumnFilter: false,
    },
  ]
}
