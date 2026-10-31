import type { InferOutput } from "valibot"
import type { activitiesResponseSchema } from "@workspace/shared/shifts"
import { Link } from "@tanstack/react-router"
import {
  japanDateTime,
  japanMonthDayWeekday,
  japanTime,
} from "@workspace/shared/japan-time"
import {
  matchesTableFilter,
  matchesTableSearch,
  type DataColumn,
} from "@workspace/ui/lib/data-table"
export type ActivityTableRow = InferOutput<
  typeof activitiesResponseSchema
>["activities"][number]
export const activityTableColumns: DataColumn<ActivityTableRow>[] = [
  {
    id: "dates",
    accessorFn: (item) => item.startsAt,
    sortFn: (a, b) =>
      a.original.startsAt.localeCompare(b.original.startsAt) ||
      a.original.name.localeCompare(b.original.name, "ja"),
    filterFn: (row, _id, value: unknown) =>
      matchesTableFilter([japanDateTime(row.original.startsAt).date], value),
    meta: { width: "19%" },
    header: "日時",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {japanMonthDayWeekday(row.original.startsAt)}{" "}
        {japanTime(row.original.startsAt)}-{japanTime(row.original.endsAt)}
      </span>
    ),
  },
  {
    id: "search",
    accessorFn: (item) => item.name,
    enableSorting: false,
    filterFn: (row, _id, value: unknown) =>
      matchesTableSearch(row.original.name, value),
    meta: { width: "28%" },
    header: "シフト",
    cell: ({ row }) => (
      <Link
        to="/manage/shifts/$shiftId"
        params={{ shiftId: row.original.id }}
        preload="intent"
        className="block rounded-sm font-medium break-words after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    id: "responsibles",
    accessorFn: (item) => item.responsibleNames,
    enableSorting: false,
    filterFn: (row, _id, value: unknown) =>
      matchesTableFilter(row.original.responsibleNames, value),
    meta: {
      label: "担当",
      width: "22%",
      className: "text-xs text-muted-foreground",
    },
    header: "担当",
    cell: ({ row }) => row.original.responsibleNames.join("、") || "—",
  },
  {
    id: "places",
    accessorFn: (item) => item.place,
    enableSorting: false,
    filterFn: (row, _id, value: unknown) =>
      matchesTableFilter([row.original.place], value),
    meta: {
      label: "場所",
      width: "17%",
      className: "text-xs text-muted-foreground",
    },
    header: "場所",
    cell: ({ row }) => row.original.place || "—",
  },
  {
    id: "status",
    accessorFn: (item) => item.active,
    enableSorting: false,
    filterFn: (row, _id, value: unknown) =>
      matchesTableFilter([row.original.active ? "active" : "inactive"], value),
    meta: { width: "14%" },
    header: "状態",
    cell: ({ row }) => (
      <span
        className={`text-xs ${row.original.active ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}
      >
        {row.original.active ? "有効" : "無効"}
      </span>
    ),
  },
]
