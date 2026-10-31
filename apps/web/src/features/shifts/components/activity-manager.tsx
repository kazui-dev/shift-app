import {
  activityTableColumns,
  type ActivityTableRow,
} from "./activity-table-columns"
import type { ActivityFilters } from "../activity-filters"
import { useTable } from "@tanstack/react-table"
import { DataTable } from "@workspace/ui/components/data-table"
import { dataTableFeatures } from "@workspace/ui/lib/data-table"
import { useShiftView } from "../shift-view-context"
import { emptyFilter, pruneFilter } from "@workspace/ui/lib/filters"
import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { activitiesQuery } from "@/features/shifts/data/activities"
import { Button } from "@workspace/ui/components/button"
import { japanDateTime, japanDateWeekday } from "@workspace/shared/japan-time"

const emptyActivities: ActivityTableRow[] = []

export function ActivityManager({ year }: { year: number }) {
  const query = useQuery(activitiesQuery(year))
  const activities = query.data?.activities ?? emptyActivities
  const shiftView = useShiftView(year)
  const search = shiftView.listSearch ?? ""
  const status = shiftView.listStatus ?? emptyFilter()
  const filters = useMemo(
    () =>
      shiftView.listFilters ?? {
        dates: emptyFilter(),
        responsibles: emptyFilter(),
        places: emptyFilter(),
      },
    [shiftView.listFilters]
  )
  const dates = [
    ...new Set(activities.map((item) => japanDateTime(item.startsAt).date)),
  ].sort()
  const responsibles = [
    ...new Set(activities.flatMap((item) => item.responsibleNames)),
  ].sort((a, b) => a.localeCompare(b, "ja"))
  const places = [...new Set(activities.map((item) => item.place))].sort(
    (a, b) => a.localeCompare(b, "ja")
  )
  useEffect(() => {
    if (!query.isSuccess || query.isFetching || !shiftView.listFilters) return
    const next = {
      dates: pruneFilter(filters.dates, dates),
      responsibles: pruneFilter(filters.responsibles, [
        ...responsibles,
        "unset",
      ]),
      places: pruneFilter(filters.places, places),
    }
    if (
      next.dates !== filters.dates ||
      next.responsibles !== filters.responsibles ||
      next.places !== filters.places
    )
      shiftView.save({ listFilters: next })
  }, [
    query.isSuccess,
    query.isFetching,
    shiftView,
    filters,
    dates,
    responsibles,
    places,
  ])
  function setFilter(key: keyof ActivityFilters, value: typeof filters.dates) {
    shiftView.save({ listFilters: { ...filters, [key]: value } })
  }
  const table = useTable({
    features: dataTableFeatures,
    columns: activityTableColumns,
    data: activities,
    getRowId: (item) => item.id,
    enableRowSelection: false,
    state: {
      sorting: [{ id: "dates", desc: false }],
      columnFilters: [
        { id: "dates", value: filters.dates },
        { id: "responsibles", value: filters.responsibles },
        { id: "places", value: filters.places },
        { id: "status", value: status },
        { id: "search", value: search },
      ],
    },
  })
  return (
    <div>
      {query.isError && (
        <p role="alert" className="py-4">
          シフトを取得できませんでした。
          <Button
            size="sm"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            再試行
          </Button>
        </p>
      )}
      <DataTable
        table={table}
        columnFilters={{
          dates: {
            kind: "choices",
            label: "日付",
            options: dates.map((date) => ({
              value: date,
              label: japanDateWeekday(`${date}T12:00:00+09:00`),
            })),
            value: filters.dates,
            optionsReady: query.isSuccess && !query.isFetching,
            onChange: (value) => setFilter("dates", value),
          },
          search: {
            kind: "text",
            label: "シフト",
            placeholder: "シフト名を入力",
            value: search,
            onChange: (value) => shiftView.save({ listSearch: value }),
          },
          responsibles: {
            kind: "choices",
            label: "担当",
            options: [
              { value: "unset", label: "未設定" },
              ...responsibles.map((name) => ({ value: name, label: name })),
            ],
            value: filters.responsibles,
            optionsReady: query.isSuccess && !query.isFetching,
            onChange: (value) => setFilter("responsibles", value),
          },
          places: {
            kind: "choices",
            label: "場所",
            options: places.map((place) => ({
              value: place,
              label: place || "未設定",
            })),
            value: filters.places,
            optionsReady: query.isSuccess && !query.isFetching,
            onChange: (value) => setFilter("places", value),
          },
          status: {
            kind: "choices",
            label: "状態",
            optionsReady: true,
            searchable: false,
            options: [
              { value: "active", label: "有効" },
              { value: "inactive", label: "無効" },
            ],
            value: status,
            onChange: (value) => shiftView.save({ listStatus: value }),
          },
        }}
        label="シフト一覧"
        empty={
          query.data && !query.isError
            ? activities.length
              ? "条件に一致するシフトがありません。"
              : "この年度にはシフトがありません。"
            : undefined
        }
      />
    </div>
  )
}
